# Product discovery notes

## Product direction

The planner should feel like a travel search product whose inventory happens to be spatial. Users begin with an activity and intent, then the application assembles the right GIS context. “Layers” remains available as a power tool, but is not the first decision a hunter must make.

The prototype expresses that direction through:

1. prominent activity groupings;
2. suggested layer sets for every activity;
3. an Expedia-style narrowing step for species, season, and place;
4. a full-height map center with search, basemap, locate, scale, and layer controls; and
5. explicit planning-only/legal-record messaging.

The second `/search` option tests a different entry model inspired by travel search: persistent criteria and filter chips, ranked opportunity cards, and a synchronized map. Its service stack is derived from the query and YAML service signals instead of loading an activity preset. The local scorer is deliberately labeled as a concept; a production implementation could replace it with a governed AI orchestration service while retaining the same explainable catalog contract and manual overrides.

## Patterns in public feedback

Feedback on hunting and backcountry mapping tools is inconsistent about which product is “best,” but the complaints cluster tightly:

- Layer breadth is valuable, but too many overlays become clutter and make the interface feel engineered around datasets instead of decisions.
- Public/private land and access layers are often the decisive feature.
- Offline reliability, understandable download state, and web/mobile synchronization are trust issues rather than secondary conveniences.
- Boundary, trail, and road inaccuracies can have serious consequences; provenance, freshness, and verification language must be visible.
- Users want routes, waypoints, and saved planning work to remain available across devices.
- Pricing complaints often reflect loss of trust or loss of a key layer rather than price alone.

These are directional qualitative signals, not a representative survey. They should inform moderated research and analytics hypotheses, not replace them.

## Recommended production architecture

- **Client:** React 19, TypeScript, Vite, ArcGIS Maps SDK map components, Calcite components where they improve accessibility or GIS consistency.
- **Configuration:** versioned YAML validated at build and deployment time; environments may override service endpoints, API keys, feature flags, and default layer visibility.
- **GIS adapter:** a small registry that creates layers from configuration, normalizes load/error state, reports service freshness, and makes layer groups testable without React.
- **Rules API:** a separate domain service that joins seasons, species, methods, dates, hunt numbers, and legal references to spatial identifiers. GIS services should not become the sole rules database.
- **Saved plan model:** activity, filters, selected layers, map extent, waypoints/drawings, and authoritative-source timestamps represented in a shareable URL first, with accounts later if justified.
- **Observability:** service availability, load duration, failed layer requests, search success, empty states, and abandonment by planning step.
- **Accessibility:** WCAG 2.2 AA acceptance criteria, keyboard and screen-reader task testing, visible non-color layer states, reduced motion, named map regions, and a non-map results representation for core decisions.

## Suggested next slice

Connect the species and season controls to a real rules/search contract and make one complete workflow production-shaped:

> “I want to hunt elk in fall” → see applicable opportunities → compare units → open one unit → review access, restrictions, statistics, and authoritative citations → share or print the plan.

That vertical slice will clarify the data model, URL state, unit detail design, disclaimer placement, analytics events, and mobile behavior before adding drawing, GPX/KML, offline packages, or accounts.

## Sources reviewed

- Current IDFG Map Center: https://idfg.idaho.gov/ifwis/huntplanner/mapcenter/
- IDFG Hunt Planner map service: https://gisportal-idfg.idaho.gov/hosting/rest/services/Apps/HuntPlanner/MapServer
- ArcGIS React guidance: https://developers.arcgis.com/javascript/latest/react/
- ArcGIS accessibility guidance: https://developers.arcgis.com/javascript/latest/accessibility/
- BLM Idaho Surface Management Agency service: https://gis.blm.gov/idarcgis/rest/services/lands/BLM_ID_Surface_Management_Agency/FeatureServer/0
- Qualitative user discussions: Reddit communities for Gaia GPS, hunting, backpacking, and overlanding; examples are cited in the project handoff conversation.
