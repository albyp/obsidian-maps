# CLAUDE.md

## Project Overview

This project is a fork of the Obsidian Maps plugin.

Goal: Extend the plugin to better support journal with images, property, GIS, surveying, and media-rich spatial workflows while maintaining compatibility with the upstream project.

The long-term intention is to contribute improvements back to the original repository through pull requests where appropriate.

---

## Existing Stack

- Obsidian Plugin API
- TypeScript
- MapLibre GL JS
- esbuild for bundling (`npm run build` → `main.js` + `styles.css`)
- Plugin folder: `.obsidian/plugins/obsidian-maps/` in vault

---

## Architecture

### Key files

| File | Role |
| --- | --- |
| `src/main.ts` | Plugin entry, settings load/save |
| `src/map-view.ts` | `MapView` class, initialises all managers |
| `src/settings.ts` | `MapSettings` interface, defaults, settings UI tab |
| `src/map/popup.ts` | `PopupManager` — single-entry and multi-entry list popups |
| `src/map/spiderfy.ts` | `SpiderfyManager` — graph spiderfy overlay |
| `src/map/markers.ts` | `MarkerManager` — GeoJSON features, icon compositing, event handlers |
| `src/map/types.ts` | `MapMarker`, `MapMarkerProperties` interfaces |
| `src/map/utils.ts` | `coordinateFromValue`, `parseCoordinate` |
| `styles.css` | All plugin CSS |

### Manager lifecycle (map-view.ts)

```text
MapView constructor
  → new PopupManager(containerEl, app, () => settings)
  → new SpiderfyManager(mapEl, app, () => settings)
  → new MarkerManager(app, mapEl, popupManager, spiderfyManager, () => settings, ...)

map.on('load')
  → popupManager.setMap(map)
  → spiderfyManager.setMap(map)
  → markerManager.setMap(map)

destroyMap()
  → popupManager.destroy()
  → spiderfyManager.destroy()
  → map.remove()
  → markerManager.setMap(null)
  → spiderfyManager.setMap(null)
```

### Marker rendering

Markers are GeoJSON symbol features on the `marker-pins` layer. Each feature stores `entryIndex` (index into `MarkerManager.markers[]`) and a composite icon key. Icons are canvas-composited circles with optional Lucide icons.

### Popup lifecycle

- Shared single `maplibregl.Popup` instance, lazily created
- `showPopup(markers[], coordinates, ...)` — single entry → `createPopupContent()`, multiple → `createMultiEntryContent()`
- `hidePopup()` uses configurable delay (`popupCloseDelay`) when `interactivePopups` is on, else 150 ms
- Popup element has mouseenter/mouseleave handlers to cancel/restart the hide timeout

### Spiderfy lifecycle

- On hover of a cluster, `getNearbyMarkers(point)` queries rendered features within a 60×60 px bbox
- `SpiderfyManager.show(markers, coordinates)` creates an SVG overlay (lines) and a div overlay (cards) inside `mapEl`
- Cards are positioned using `map.project([lng, lat])` and repositioned on `map.on('move')` / `map.on('zoom')`
- Cards have mouseenter/mouseleave to cancel/restart the hide timeout
- `tearDown()` removes SVG and cards and deregisters move/zoom listeners

---

## Current Settings (`MapSettings`)

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `tileSets` | `TileSet[]` | `[]` | Custom map backgrounds |
| `interactivePopups` | `boolean` | `false` | Use configurable close delay |
| `popupCloseDelay` | `number` | `300` | ms before popup/spiderfy closes |
| `multiNoteDisplay` | `'list' \| 'spiderfy'` | `'list'` | How to show clustered notes |

---

## Completed Work

### PR 1 — Interactive / Persistent Popups ✓

- Added `interactivePopups` toggle and `popupCloseDelay` slider to settings UI
- `PopupManager` accepts a `getSettings` getter; `hidePopup()` uses configurable delay
- Existing hover-persistence mechanism (mouseenter on popup cancels hide timeout) unchanged

### PR 2 — Multiple Notes at Same Coordinates ✓

- `showPopup()` signature changed from single `BasesEntry` to `MapMarker[]`
- Single marker → `createPopupContent()` (unchanged UX)
- Multiple markers → `createMultiEntryContent()`: header "N notes at this location" + compact title-only links per entry (no images in list)
- Multi-entry popup has `max-height: 60vh; overflow-y: auto`

### PR 3 — Graph Spiderfy ✓ (just implemented, not yet tested)

- New `src/map/spiderfy.ts` — `SpiderfyManager`
- `getNearbyMarkers(point)` replaces `getMarkersAtCoordinates` — uses `queryRenderedFeatures` with 60×60 px bbox, covers both identical-coordinate stacks and nearby markers
- Settings toggle: `multiNoteDisplay: 'list' | 'spiderfy'`
- Spiderfy: SVG lines radiate from marker to floating mini-cards; cards reposition on pan/zoom
- Card label uses `entry.file.basename` (safe — never renders as an image)

---

## Remaining Work

### Next: Rich Image Cards (single-note popup)

Enhance `createPopupContent()` in `popup.ts` to detect image frontmatter fields (`img`, `image`, `thumbnail`, `cover`) and render a card layout:

```text
[Image — max 100% wide, max 200px tall, object-fit: cover]
Title (link)
label  value
label  value
```

Gracefully degrade if no image field exists.

### Later: Image Markers

Allow markers to render a thumbnail from frontmatter instead of the default circle pin. Must stay performant — needs a clustering or lazy-load strategy.

---

## Development Principles

### Preserve Existing Behaviour

All new functionality should be optional, configurable, and default to current behaviour.

### Small Incremental Changes

Prefer small PR-sized improvements and settings toggles. Avoid large architectural rewrites.

---

## Coding Standards

- TypeScript only
- Keep functions small
- Comment only non-obvious behaviour (not what, only why)
- Prefer composition over duplication
- Preserve upstream style

---

## Pull Request Strategy

| PR | Feature | Status |
| --- | --- | --- |
| PR 1 | Interactive popup behaviour | Done ✓ |
| PR 2 | Multiple notes at identical coordinates | Done ✓ |
| PR 3 | Graph spiderfy for nearby/stacked markers | Implemented, needs test |
| PR 4 | Rich image cards (single-note popup) | Next |
| PR 5 | Image markers | Later |

Keep each PR independently mergeable.

---

## Build & Deploy

```bash
npm run build          # compiles src/ → main.js + styles.css
```

Copy `main.js` and `styles.css` to `.obsidian/plugins/obsidian-maps/` in your vault, then disable/re-enable the plugin in Obsidian settings (or Ctrl+R to fully restart).
