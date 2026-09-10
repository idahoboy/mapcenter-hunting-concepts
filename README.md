# Idaho Hunt Planner — modern map-center prototype

A React 19 and ArcGIS Maps SDK proof of concept for a map-first, accessible Idaho hunting planner. The prototype uses live public GIS services already consumed by Idaho Fish and Game and keeps product configuration in YAML.

Four connected design options are available:

- `/` — the activity-first Map Center concept;
- `/search` — a VRBO-inspired opportunity search with filters, ranked unit cards, and a query-derived GIS service stack; and
- `/hunt/82313` and `/hunt/78813` — controlled-hunt and general-season result-page examples with live boundaries, rules, statistics, access, and licensing information; and
- `/compare` — a persistent **My Hunt Plan** shortlist and side-by-side decision workspace with a live, combined ArcGIS boundary map. Hunts can be saved from search cards or detail pages and remain selected in the browser between visits.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## What is configurable

`src/config/hunt-planner.yml` controls:

- activity groupings and their suggested layer sets;
- layer groups, labels, descriptions, service URLs, opacity, and default visibility;
- default map center, zoom, basemap, and disclaimer content; and
- basemap choices.

Layer `signals` are catalog metadata used by the `/search` prototype to score services against the user's words and filters. The search page does not use the activity `suggestedLayers` bundles.

Layer `identify` metadata controls the shared **What's here?** map summary. A map click queries every visible, identifiable service at that location and groups matching boundaries into hunt, restriction, access, ownership, and nearby-place context without exposing raw GIS attributes.

## Prototype boundaries

This is a discovery prototype, not a production hunting-regulation system. Search, season filtering, legal-rule joins, printing, offline packages, analytics, authentication, and saved plans require product and data contracts before implementation. All map data should be treated as planning context and checked against current regulations and authoritative legal descriptions.
