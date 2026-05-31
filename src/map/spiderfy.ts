import { App, BasesEntry, BasesPropertyId, TFile } from 'obsidian';
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
	private activeImageProp: BasesPropertyId | null = null;
	private armLengths: number[] = [];

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

	show(markers: MapMarker[], coordinates: [number, number], imageProp: BasesPropertyId | null = null): void {
		this.clearHideTimeout();
		this.tearDown();

		this.activeMarkers = markers;
		this.activeCoordinates = coordinates;
		this.activeImageProp = imageProp;

		// SVG overlay for lines
		const svgEl = this.svgEl = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
		svgEl.addClass('bases-map-spiderfy-svg');
		this.mapEl.appendChild(svgEl);

		// Cards container
		const cardsEl = this.cardsEl = this.mapEl.createDiv('bases-map-spiderfy-cards');

		this.cardEls = [];
		this.lineEls = [];
		this.armLengths = [];

		const n = markers.length;
		const mapW = this.mapEl.offsetWidth || 600;
		const mapH = this.mapEl.offsetHeight || 400;
		const maxRadius = Math.min(mapW, mapH) * 0.38;
		// Minimum radius so adjacent cards don't overlap at their arc chord.
		// cardW is wider when images are shown (~210px) vs. text-only (~170px).
		const cardW = imageProp ? 210 : 170;
		const geoMin = n <= 1 ? 90 : Math.ceil((cardW / 2) / Math.sin(Math.PI / n));
		const baseRadius = Math.min(Math.max(90, geoMin), maxRadius);

		for (const marker of markers) {
			// SVG line (positions filled in by render())
			const line = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
			line.addClass('bases-map-spiderfy-line');
			svgEl.appendChild(line);
			this.lineEls.push(line);

			// Card div
			const cardEl = cardsEl.createDiv('bases-map-spiderfy-card');

			// Thumbnail image (only when an image property is configured)
			if (imageProp) {
				const imgSrc = this.resolveImageSrc(marker.entry, imageProp);
				if (imgSrc) {
					const imgEl = cardEl.createEl('img', { cls: 'bases-map-spiderfy-card-img' });
					imgEl.src = imgSrc;
				}
			}

			const title = marker.entry.file.basename;
			const linkEl = cardEl.createEl('a', { href: marker.entry.file.path, cls: 'internal-link' });
			linkEl.textContent = title;

			cardEl.addEventListener('mouseenter', () => this.clearHideTimeout());
			cardEl.addEventListener('mouseleave', () => this.hide());
			this.cardEls.push(cardEl);

			this.armLengths.push(baseRadius);
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
		this.armLengths = [];
		this.activeMarkers = null;
		this.activeCoordinates = null;
		this.activeImageProp = null;
	}

	private render(): void {
		if (!this.map || !this.activeCoordinates || !this.activeMarkers) return;

		const n = this.activeMarkers.length;
		const cardHalfW = this.activeImageProp ? 105 : 85;
		const cardHalfH = this.activeImageProp ? 20 : 16;
		const mapW = this.mapEl.offsetWidth || 600;
		const mapH = this.mapEl.offsetHeight || 400;

		// Project each marker to pixel space; derive centroid for card placement
		const markerPixels = this.activeMarkers.map(m => {
			const [lat, lng] = m.coordinates;
			return this.map!.project([lng, lat]);
		});
		const centroid = markerPixels.reduce(
			(acc, px) => ({ x: acc.x + px.x / n, y: acc.y + px.y / n }),
			{ x: 0, y: 0 }
		);

		for (let i = 0; i < n; i++) {
			const angle = -Math.PI / 2 + (2 * Math.PI / n) * i;
			const arm = this.armLengths[i] ?? 100;
			const rawX = centroid.x + arm * Math.cos(angle);
			const rawY = centroid.y + arm * Math.sin(angle);

			// Clamp so cards stay within the map viewport
			const cardX = Math.max(cardHalfW, Math.min(mapW - cardHalfW, rawX));
			const cardY = Math.max(cardHalfH, Math.min(mapH - cardHalfH, rawY));

			// Line from this marker's own pixel position to its card
			const markerPx = markerPixels[i];
			const line = this.lineEls[i];
			line.setAttribute('x1', String(markerPx.x));
			line.setAttribute('y1', String(markerPx.y));
			line.setAttribute('x2', String(cardX));
			line.setAttribute('y2', String(cardY));

			const card = this.cardEls[i];
			card.style.left = `${cardX}px`;
			card.style.top = `${cardY}px`;
		}
	}

	// Resolve a frontmatter property value to a displayable image URL.
	// Handles vault-relative paths, wikilinks ([[file.jpg]]), and https:// URLs.
	private resolveImageSrc(entry: BasesEntry, prop: BasesPropertyId): string | null {
		let raw: unknown;
		try {
			const cache = this.app.metadataCache.getFileCache(entry.file);
			raw = cache?.frontmatter?.[prop as string];
		} catch {
			return null;
		}

		if (!raw || typeof raw !== 'string') return null;

		// Strip wikilink syntax: ![[path|alias]] → path
		let path = raw.trim()
			.replace(/^!?\[\[(.+?)\]\]$/, '$1')
			.replace(/\|.*$/, '');

		if (!path) return null;

		// Resolve as a vault file first
		const file: TFile | null = this.app.metadataCache.getFirstLinkpathDest(path, entry.file.path);
		if (file) return this.app.vault.getResourcePath(file);

		// Fall back to bare URL
		if (/^https?:\/\//.test(path)) return path;

		return null;
	}
}
