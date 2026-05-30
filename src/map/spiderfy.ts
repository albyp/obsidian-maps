import { App } from 'obsidian';
import { Map } from 'maplibre-gl';
import { MapMarker } from './types';
import { MapSettings } from '../settings';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SpiderfyManager {
	private map: Map | null = null;
	private mapEl: HTMLElement;
	private app: App;
	private getSettings: () => MapSettings;

	private svgEl: SVGSVGElement | null = null;
	private cardsEl: HTMLElement | null = null;
	private cardEls: HTMLElement[] = [];
	private lineEls: SVGLineElement[] = [];

	private activeMarkers: MapMarker[] | null = null;
	private activeCoordinates: [number, number] | null = null;

	private hideTimeout: number | null = null;
	private hideTimeoutWin: Window | null = null;
	private onMoveHandler: (() => void) | null = null;

	constructor(mapEl: HTMLElement, app: App, getSettings: () => MapSettings) {
		this.mapEl = mapEl;
		this.app = app;
		this.getSettings = getSettings;
	}

	setMap(map: Map | null): void {
		this.map = map;
	}

	show(markers: MapMarker[], coordinates: [number, number]): void {
		this.clearHideTimeout();
		this.tearDown();

		this.activeMarkers = markers;
		this.activeCoordinates = coordinates;

		// SVG overlay for lines
		const svgEl = this.svgEl = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
		svgEl.addClass('bases-map-spiderfy-svg');
		this.mapEl.appendChild(svgEl);

		// Cards container
		const cardsEl = this.cardsEl = this.mapEl.createDiv('bases-map-spiderfy-cards');

		this.cardEls = [];
		this.lineEls = [];

		for (const marker of markers) {
			// SVG line (positions filled in by render())
			const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
			line.addClass('bases-map-spiderfy-line');
			svgEl.appendChild(line);
			this.lineEls.push(line);

			// Card div
			const cardEl = cardsEl.createDiv('bases-map-spiderfy-card');
			const title = this.getTitleText(marker);
			const linkEl = cardEl.createEl('a', { href: marker.entry.file.path, cls: 'internal-link' });
			linkEl.textContent = title;

			cardEl.addEventListener('mouseenter', () => this.clearHideTimeout());
			cardEl.addEventListener('mouseleave', () => this.hide());
			this.cardEls.push(cardEl);
		}

		this.render();

		// Reposition on pan/zoom
		this.onMoveHandler = () => this.render();
		this.map?.on('move', this.onMoveHandler);
		this.map?.on('zoom', this.onMoveHandler);
	}

	hide(): void {
		this.clearHideTimeout();
		const settings = this.getSettings();
		const delay = settings.interactivePopups ? settings.popupCloseDelay : 150;
		const win = this.hideTimeoutWin = this.mapEl.win;
		this.hideTimeout = win.setTimeout(() => {
			this.tearDown();
			this.hideTimeout = null;
			this.hideTimeoutWin = null;
		}, delay);
	}

	clearHideTimeout(): void {
		if (this.hideTimeout !== null) {
			const win = this.hideTimeoutWin ?? this.mapEl.win;
			win.clearTimeout(this.hideTimeout);
		}
		this.hideTimeout = null;
		this.hideTimeoutWin = null;
	}

	destroy(): void {
		this.clearHideTimeout();
		this.tearDown();
	}

	private tearDown(): void {
		if (this.onMoveHandler) {
			this.map?.off('move', this.onMoveHandler);
			this.map?.off('zoom', this.onMoveHandler);
			this.onMoveHandler = null;
		}
		this.svgEl?.remove();
		this.svgEl = null;
		this.cardsEl?.remove();
		this.cardsEl = null;
		this.cardEls = [];
		this.lineEls = [];
		this.activeMarkers = null;
		this.activeCoordinates = null;
	}

	private render(): void {
		if (!this.map || !this.activeCoordinates || !this.activeMarkers) return;

		const [lat, lng] = this.activeCoordinates;
		const centerPx = this.map.project([lng, lat]);
		const n = this.activeMarkers.length;
		const radius = Math.max(90, 70 + n * 10);

		for (let i = 0; i < n; i++) {
			const angle = -Math.PI / 2 + (2 * Math.PI / n) * i;
			const cardX = centerPx.x + radius * Math.cos(angle);
			const cardY = centerPx.y + radius * Math.sin(angle);

			const line = this.lineEls[i];
			line.setAttribute('x1', String(centerPx.x));
			line.setAttribute('y1', String(centerPx.y));
			line.setAttribute('x2', String(cardX));
			line.setAttribute('y2', String(cardY));

			const card = this.cardEls[i];
			card.style.left = `${cardX}px`;
			card.style.top = `${cardY}px`;
		}
	}

	private getTitleText(marker: MapMarker): string {
		// Prefer the file basename as the card label — always available and never renders as an image
		return marker.entry.file.basename;
	}
}
