# Idaho Opportunity Explorer — modern map-center prototype

A React 19 and ArcGIS Maps SDK proof of concept for a map-first, accessible Idaho opportunity explorer. Hunt facts come from the live Hunt Planner API 1.1, geometry comes from live public GIS services, and product configuration remains in YAML.

Four connected design options are available:

- `/` — the activity-first Map Center concept;
- `/search` — a VRBO-inspired opportunity search with filters, ranked unit cards, and a query-derived GIS service stack; and
- `/hunt/82313` and `/hunt/78813` — controlled-hunt and general-season result-page examples with live boundaries, rules, statistics, access, and licensing information; and
- `/compare` — a persistent **My plan** shortlist and side-by-side decision workspace with a live, combined ArcGIS boundary map. Opportunities can be saved from search cards or detail pages and remain selected in the browser between visits.

Opportunity filters support multiple simultaneous selections. Region filtering and the toggleable **IDFG administrative regions** layer are derived at runtime from IDFG's live region and GMU services; no region GeoJSON is bundled with the app.

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

`dataProviders` defines versioned planner APIs. Hunt Planner 1.1 is active. Fishing Planner 2.0 is configured as planned so it can use the same provider-adapter pattern later.

The browser calls Hunt Planner through its same-origin `/ifwis/huntplanner/api/1.1` path. `vite.config.js` proxies that path to `idfg.idaho.gov` during local development because the legacy API does not emit browser CORS headers. An external production host will need the equivalent pass-through; deployment beneath `idfg.idaho.gov` can use the relative path directly. API responses already provide a 20-minute public cache policy, so no duplicate GeoJSON or hunt-record cache is required.

## Prototype boundaries

This is a discovery prototype, not a production hunting-regulation system. API 1.1 does not expose the Hunt Area GIS feature identifier, so the detail and comparison maps conservatively show inferred GMU context where a single unit can be resolved. All map data should be treated as planning context and checked against current regulations and authoritative legal descriptions.
