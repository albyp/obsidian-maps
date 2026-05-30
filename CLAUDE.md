# CLAUDE.md

## Project Overview

This project is a fork of the Obsidian Maps plugin.

Goal: Extend the plugin to better support journal with images, property, GIS, surveying, and media-rich spatial workflows while maintaining compatibility with the upstream project.

The long-term intention is to contribute improvements back to the original repository through pull requests where appropriate.

Primary focus areas:

1. Persistent map popups
2. Interactive popup cards
3. Multiple notes at identical coordinates
4. Image-first markers
5. Rich property/media card layouts
6. Improved UX for dense spatial datasets

---

## Existing Stack

The plugin currently uses:

* Obsidian Plugin API
* TypeScript
* MapLibre GL JS
* Existing Obsidian Maps data models and marker rendering

Before making changes:

* Understand plugin architecture
* Understand popup lifecycle
* Understand marker creation workflow
* Understand note metadata rendering
* Identify where markers and popups are created

---

## Development Principles

### Preserve Existing Behaviour

All new functionality should:

* Be optional
* Be configurable
* Default to current behaviour unless there is a compelling reason otherwise

Avoid breaking existing users.

---

### Small Incremental Changes

Prefer:

* Small PR-sized improvements
* Feature flags
* Settings toggles

Avoid:

* Large architectural rewrites
* Unnecessary refactors

---

## Feature 1: Persistent Popups

### Current Behaviour

Current workflow appears to be:

mouseenter -> create popup

mouseleave -> destroy popup

This makes image previews and interactive content difficult to use.

### Desired Behaviour

Configurable popup persistence.

Example:

mouseenter -> show popup

mouseleave -> start timeout

popup hover -> cancel timeout

popup leave -> hide popup

### Settings

Add settings such as:

* Enable interactive popups
* Popup close delay (ms)
* Open popup on hover
* Open popup on click
* Popup automatically open
* Marker as image

### Success Criteria

Users can:

* Move cursor onto popup
* Interact with links
* View images
* Read content without popup disappearing

---

## Feature 2: Multiple Notes At Same Coordinates

### Problem

Many notes may share identical coordinates.

Examples:

* Property sales
* Apartment complexes
* Survey control points
* Multiple observations

Currently markers overlap.

### Investigate Existing Behaviour

Determine:

* Whether markers are de-duplicated
* Whether only one marker is rendered
* Whether multiple markers exist but overlap

### Desired Behaviour

Support one or more of:

#### Option A

Stacked popup list

Example:

Location

* Note A
* Note B
* Note C

#### Option B

Spiderfy behaviour

One marker expands into multiple markers.

#### Option C

Carousel view

Users can cycle through notes.

### Preferred Initial Solution

Stacked popup list.

This is simpler and aligns well with Obsidian workflows.

---

## Feature 3: Rich Image Cards

### Current Goal

Support image-rich note previews.

Many notes contain:

* img
* image
* thumbnail
* cover

frontmatter fields.

### Desired Behaviour

Popup card displays:

* Image
* Title
* Summary
* Tags
* Metadata

Example card layout:

---

[Image]

Property Name

Location

Metadata

---

### Requirements

Cards should gracefully degrade if no image exists.

---

## Feature 4: Image Markers

### Stretch Goal

Allow markers to render thumbnails.

Examples:

Circular image markers

or

Small property-card markers

instead of standard pins.

### Requirements

Must remain performant.

Need clustering strategy if implemented.

---

## Feature 5: Popup Architecture

Investigate replacing direct popup ownership.

Current:

Marker -> Popup

Potential future:

Marker -> Popup Manager

Benefits:

* Reusable popups
* Multiple popup types
* Pinned popups
* Better lifecycle management

Do not implement unless necessary.

---

## Areas To Investigate

Search codebase for:

popup

Popup

mouseenter

mouseleave

mouseover

mouseout

Marker

MapLibre

maplibregl.Popup

maplibregl.Marker

Understand existing lifecycle before making changes.

---

## UX Inspiration

Research patterns from:

Airbnb

Zillow

Google Maps

Mapbox examples

PhotoPrism

Focus on:

* Image-first markers
* Interactive cards
* Hover persistence
* Dense datasets
* Cluster expansion

---

## Coding Standards

* TypeScript only
* Keep functions small
* Add comments where behaviour is non-obvious
* Prefer composition over duplication
* Preserve upstream style

---

## Pull Request Strategy

Target separate PRs:

PR 1
Interactive popup behaviour

PR 2
Multiple notes at identical coordinates

PR 3
Rich image cards

PR 4
Image markers

Keep each PR independently mergeable.

---

## Deliverables

For each completed feature:

1. Code implementation
2. Settings UI
3. Documentation updates
4. Screenshots
5. Migration notes if required

Always explain architectural decisions before making large changes.
