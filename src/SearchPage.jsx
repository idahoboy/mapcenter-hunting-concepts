import { useEffect, useMemo, useRef, useState } from 'react';
import Graphic from '@arcgis/core/Graphic.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  Layers3,
  MapPin,
  PawPrint,
  Search,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react';
import config, { allLayers } from './config.js';
import { deriveLayerStack } from './layerIntelligence.js';
import { createLayer } from './mapLayers.js';
import SiteHeader from './SiteHeader.jsx';
import LocationSummaryPopup from './LocationSummaryPopup.jsx';
import { useMapIdentify } from './useMapIdentify.js';
import { useHuntPlan } from './useHuntPlan.js';
import { fetchCatalog } from './huntPlannerApi.js';
import { filterOpportunities } from './opportunityFilters.js';
import { fetchRegionLookup, REGION_NAMES } from './regionContext.js';
import { createFallbackOpportunityPlan, interpretOpportunitySearch, resolveCatalogSearch } from './aiOpportunitySearch.js';
import MatchExplanation from './MatchExplanation.jsx';
import { buildUnitWhereClause, getCombinedExtent, getHuntMapUnits } from './huntMapSelection.js';
import './search-page.css';
import './location-summary.css';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

const initialFilters = {
  species: [],
  season: [],
  huntType: [],
  region: [],
  sex: [],
};

const filterOptions = {
  species: { label: 'Species', options: ['Elk', 'Deer', 'Pronghorn', 'Black Bear', 'Moose'] },
  season: { label: 'Season', options: ['Any Weapon', 'Archery', 'Muzzleloader', 'Short-Range Weapon', 'Youth'] },
  huntType: { label: 'Hunt type', options: ['General season', 'Controlled hunt'] },
  region: { label: 'Region', options: REGION_NAMES },
};

const alphaCompare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
const dateValue = (hunt) => {
  const [month, day, year] = String(hunt.open ?? '').split('/').map(Number);
  return month && day && year ? new Date(2000 + year, month - 1, day).getTime() : Number.MAX_SAFE_INTEGER;
};
const sortOpportunities = (rows, mode) => [...rows].sort((a, b) => {
  if (mode === 'date') return dateValue(a) - dateValue(b) || alphaCompare(a.areaLabel || a.unit, b.areaLabel || b.unit);
  const key = mode === 'tag' ? 'tag' : mode === 'sex' ? 'sex' : mode === 'species' ? 'species' : mode === 'weapon' ? 'method' : 'areaLabel';
  return alphaCompare(a[key] || (key === 'areaLabel' ? a.unit : ''), b[key] || (key === 'areaLabel' ? b.unit : '')) || alphaCompare(a.id, b.id);
});
const speciesMatches = (hunt, option) => option === 'Deer'
  ? String(hunt.species ?? '').toLowerCase().includes('deer')
  : String(hunt.species ?? '') === option;

function MultiSelectFilter({ label, options, selected, onChange }) {
  const summary = selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${label} · ${selected.length}`;
  return (
    <details className="multi-filter">
      <summary>{summary}<ChevronDown size={15} aria-hidden="true" /></summary>
      <div className="multi-filter-menu" aria-label={`${label} options`}>
        <div><strong>{label}</strong>{selected.length > 0 && <button type="button" onClick={() => onChange([])}>Clear</button>}</div>
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

function SearchPage() {
  const mapRef = useRef(null);
  const layerInstances = useRef(new Map());
  const huntAreaLayer = useRef(null);
  const highlightHandle = useRef(null);
  const selectionGraphics = useRef([]);
  const searchLocationGraphic = useRef(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedHunt, setSelectedHunt] = useState(null);
  const [resultView, setResultView] = useState('alpha');
  const [catalog, setCatalog] = useState([]);
  const [regionLookup, setRegionLookup] = useState(new Map());
  const [regionState, setRegionState] = useState('loading');
  const [apiState, setApiState] = useState('loading');
  const [stackOpen, setStackOpen] = useState(
    () => !window.matchMedia('(max-width: 760px)').matches,
  );
  const [manualOverrides, setManualOverrides] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [status, setStatus] = useState('Search assistant ready.');
  const { summary: locationSummary, attach: attachIdentify, close: closeIdentify, zoomTo: zoomToIdentify } = useMapIdentify(layerInstances, allLayers);
  const { isSaved, toggle: toggleSavedHunt } = useHuntPlan();
  const activeFilterOptions = useMemo(() => ({
    ...filterOptions,
    sex: {
      label: 'Sex / ornament',
      options: [...new Set(catalog
        .filter((hunt) => !filters.species.length || filters.species.some((option) => speciesMatches(hunt, option)))
        .map((hunt) => hunt.sex).filter(Boolean))].sort(alphaCompare),
    },
  }), [catalog, filters.species]);

  useEffect(() => () => {
    highlightHandle.current?.remove();
    const view = mapRef.current?.view;
    if (view && selectionGraphics.current.length) view.graphics.removeMany(selectionGraphics.current);
    if (view && searchLocationGraphic.current) view.graphics.remove(searchLocationGraphic.current);
  }, []);

  useEffect(() => {
    const view = mapRef.current?.view;
    if (!view) return;
    if (searchLocationGraphic.current) {
      view.graphics.remove(searchLocationGraphic.current);
      searchLocationGraphic.current = null;
    }
    if (!aiPlan?.location) return;
    const { longitude, latitude, label } = aiPlan.location;
    const graphic = new Graphic({
      geometry: { type: 'point', longitude, latitude, spatialReference: { wkid: 4326 } },
      attributes: { label, role: 'search-location' },
      symbol: {
        type: 'simple-marker',
        style: 'diamond',
        color: [255, 255, 255, 1],
        size: 15,
        outline: { color: [116, 43, 20, 1], width: 3 },
      },
      popupTemplate: null,
    });
    searchLocationGraphic.current = graphic;
    view.graphics.add(graphic);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    view.goTo({ target: graphic, zoom: 9 }, { duration: reducedMotion ? 0 : 550 }).catch(() => {});
  }, [aiPlan]);

  useEffect(() => {
    let active = true;
    setApiState('loading');
    fetchCatalog().then((records) => {
      if (!active) return;
      setCatalog(records);
      setApiState('ready');
      setStatus(`${records.length.toLocaleString()} live opportunities returned by Hunt Planner API 1.1.`);
    }).catch(() => {
      if (!active) return;
      setApiState('error');
      setStatus('Hunt Planner API 1.1 is temporarily unavailable.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetchRegionLookup().then((lookup) => {
      if (!active) return;
      setRegionLookup(lookup);
      setRegionState('ready');
    }).catch(() => {
      if (active) setRegionState('error');
    });
    return () => { active = false; };
  }, []);

  const filteredOpportunities = useMemo(
    () => filterOpportunities(catalog, { search: submittedQuery, filters, regionLookup, dateRange: aiPlan?.dateRange }),
    [catalog, submittedQuery, filters, regionLookup, aiPlan],
  );
  const resultTotal = filteredOpportunities.length;
  const sortedOpportunities = useMemo(() => sortOpportunities(filteredOpportunities, resultView), [filteredOpportunities, resultView]);
  const opportunities = sortedOpportunities.slice(0, config.dataProviders.huntPlanner.pageSize);
  const groupedOpportunities = useMemo(() => {
    if (!['location', 'tag', 'sex', 'species', 'weapon'].includes(resultView)) return [{ label: null, items: opportunities }];
    const groups = new Map();
    opportunities.forEach((hunt) => {
      const label = resultView === 'location'
        ? hunt.areaLabel || (hunt.unit ? `Unit ${hunt.unit}` : 'Unspecified location')
        : (resultView === 'tag' ? hunt.tag : resultView === 'sex' ? hunt.sex : resultView === 'species' ? hunt.species : hunt.method) || 'Unspecified';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(hunt);
    });
    return [...groups.entries()].sort((a, b) => alphaCompare(a[0], b[0])).map(([label, items]) => ({ label, items }));
  }, [opportunities, resultView]);

  const rankedLayers = useMemo(
    () => deriveLayerStack(allLayers, query, filters),
    [query, filters],
  );

  const composedLayers = useMemo(() => {
    const threshold = rankedLayers.filter((layer) => layer.score >= 2.5).slice(0, 5);
    return new Set(
      allLayers
        .filter((layer) => manualOverrides[layer.id] ?? threshold.some((candidate) => candidate.id === layer.id))
        .map((layer) => layer.id),
    );
  }, [manualOverrides, rankedLayers]);

  useEffect(() => {
    layerInstances.current.forEach((layer, id) => {
      layer.visible = composedLayers.has(id);
    });
  }, [composedLayers]);

  const handleMapReady = (event) => {
    const mapElement = event.target;
    if (!mapElement?.map || layerInstances.current.size) return;
    allLayers.forEach((definition) => {
      const layer = createLayer({ ...definition, defaultVisible: composedLayers.has(definition.id) });
      layerInstances.current.set(definition.id, layer);
      mapElement.map.add(layer);
    });
    mapElement.view.aria = {
      label: 'Idaho hunt opportunity search map',
      description: 'A synchronized map of units and GIS services derived from the current search criteria.',
    };
    attachIdentify(mapElement.view);
    setStatus(`${composedLayers.size} services selected from the current search.`);
  };

  const optimizeMap = async () => {
    const naturalLanguageQuery = query.trim();
    setIsOptimizing(true);
    setStatus(naturalLanguageQuery
      ? 'AI is translating your request into live-data filters and map services.'
      : 'Searching Hunt Planner API 1.1 with the selected filters.');

    if (!naturalLanguageQuery) {
      setAiPlan(null);
      setManualOverrides({});
      setSubmittedQuery('');
      setIsOptimizing(false);
      setStackOpen(true);
      setStatus('Selected filters applied to Hunt Planner API 1.1 results.');
      return;
    }

    try {
      const plan = await interpretOpportunitySearch({
        query: naturalLanguageQuery,
        currentFilters: filters,
        filterOptions: activeFilterOptions,
        layers: allLayers,
      });
      const appliedPlan = { ...plan, search: resolveCatalogSearch(plan.search, catalog) };
      setFilters(appliedPlan.filters);
      setSubmittedQuery(appliedPlan.search);
      setAiPlan(appliedPlan);
      setManualOverrides(Object.fromEntries(
        allLayers.map((layer) => [layer.id, appliedPlan.layerIds.includes(layer.id)]),
      ));
      setStackOpen(true);
      setStatus(`${appliedPlan.summary} Live Hunt Planner and GIS services are now applied.${appliedPlan.location ? ` Place resolved as ${appliedPlan.location.label}.` : ''}`);
    } catch {
      const fallback = createFallbackOpportunityPlan({
        query: naturalLanguageQuery,
        currentFilters: filters,
        filterOptions: activeFilterOptions,
        layers: allLayers,
      });
      setFilters(fallback.filters);
      setAiPlan(fallback);
      setManualOverrides(Object.fromEntries(
        allLayers.map((layer) => [layer.id, fallback.layerIds.includes(layer.id)]),
      ));
      setSubmittedQuery(fallback.search);
      setStackOpen(true);
      setStatus(fallback.summary);
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateFilter = (key, values) => {
    setFilters((current) => ({ ...current, [key]: values }));
    setManualOverrides({});
  };

  const toggleLayer = (id) => {
    const next = !composedLayers.has(id);
    setManualOverrides((current) => ({ ...current, [id]: next }));
    setStatus(`${allLayers.find((layer) => layer.id === id)?.label} manually turned ${next ? 'on' : 'off'}.`);
  };

  const focusHuntArea = async (item) => {
    setSelectedHunt(item.id);
    const view = mapRef.current?.view;
    const mapUnits = getHuntMapUnits(item);
    const hasExactArea = item.map?.kind === 'hunt-area';
    const layer = hasExactArea
      ? (huntAreaLayer.current ??= new FeatureLayer({ url: item.map.url, outFields: ['*'], popupEnabled: false }))
      : layerInstances.current.get('game-units');
    if (!layer || !view || (!hasExactArea && !mapUnits.length)) {
      setStatus(`${item.areaLabel} does not resolve to a mapped hunt area.`);
      return;
    }
    try {
      if (!hasExactArea) {
        setManualOverrides((current) => ({ ...current, 'game-units': true }));
        layer.visible = true;
      }
      await layer.load();
      const response = await layer.queryFeatures({
        where: hasExactArea ? item.map.where : buildUnitWhereClause(mapUnits),
        outFields: ['*'],
        returnGeometry: true,
      });
      if (!response.features.length) throw new Error('No matching hunt-area boundaries');
      highlightHandle.current?.remove();
      if (selectionGraphics.current.length) view.graphics.removeMany(selectionGraphics.current);
      if (!hasExactArea) {
        const layerView = await view.whenLayerView(layer);
        highlightHandle.current = layerView.highlight(response.features);
      }
      selectionGraphics.current = response.features.map((feature) => new Graphic({
        geometry: feature.geometry,
        attributes: { ...feature.attributes, selectedHuntId: item.id },
        symbol: {
          type: 'simple-fill',
          color: [196, 84, 38, 0.3],
          outline: { color: [116, 43, 20, 1], width: 3 },
        },
        popupTemplate: null,
      }));
      view.graphics.addMany(selectionGraphics.current);
      const extent = getCombinedExtent(response.features);
      if (extent) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        await view.goTo(extent.expand(mapUnits.length > 1 ? 1.25 : 1.7), {
          duration: reducedMotion ? 0 : 500,
        });
      }
      const unitLabel = mapUnits.length === 1
        ? `Game Management Unit ${mapUnits[0]}`
        : `Game Management Units ${mapUnits.join(', ')}`;
      const boundaryLabel = hasExactArea ? `official Hunt Area ${item.areaLabel}` : unitLabel;
      setStatus(`${item.tag} selected and map centered on ${boundaryLabel}.`);
    } catch {
      setStatus(`${item.areaLabel} selected. Map focus is temporarily unavailable.`);
    }
  };

  return (
    <div className="search-page-shell">
      <a className="skip-link" href="#search-results">Skip to hunt opportunities</a>
      <p className="sr-only" aria-live="polite">{status}</p>
      <SiteHeader activeView="search" />

      <main className="search-workspace">
        <section className="search-command" aria-label="Opportunity search criteria">
          <div className="ai-search-box">
            <span className="ai-search-icon" aria-hidden="true"><Sparkles size={21} /></span>
            <label>
              <span>Describe the opportunity you want</span>
              <input value={query} placeholder="Try archery elk in Clearwater with public access" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && optimizeMap()} />
            </label>
            <button onClick={optimizeMap} disabled={isOptimizing}>
              <WandSparkles size={18} />{isOptimizing ? 'Searching…' : 'Search & map'}
            </button>
          </div>
          <div className="filter-strip" aria-label="Search filters">
            {Object.entries(activeFilterOptions).map(([key, definition]) => (
              <MultiSelectFilter
                key={key}
                label={definition.label}
                options={definition.options}
                selected={filters[key]}
                onChange={(values) => updateFilter(key, values)}
              />
            ))}
          </div>

          <div className="result-view-controls" aria-label="Result organization">
            <span>Organize results</span>
            {[['alpha', 'A–Z'], ['date', 'Date'], ['location', 'Location'], ['tag', 'Tag'], ['sex', 'Sex'], ['species', 'Species'], ['weapon', 'Weapon']].map(([mode, label]) => (
              <button key={mode} type="button" className={resultView === mode ? 'active' : ''} onClick={() => setResultView(mode)}>{label}</button>
            ))}
          </div>
        </section>

        <section className="search-results-pane" id="search-results" aria-labelledby="results-title">
          <div className="results-toolbar">
            <div><a href="/"><ArrowLeft size={15} />Map center</a><h1 id="results-title">2026 hunt opportunities</h1><p>{apiState === 'loading' ? 'Loading Hunt Planner API 1.1…' : apiState === 'error' ? 'Live data is temporarily unavailable' : `${resultTotal.toLocaleString()} authoritative records · showing first ${opportunities.length}`}</p></div>
            <span className="live-data-badge"><Database size={14} />API 1.1 live</span>
          </div>

          <aside className="assistant-note">
            <span><Sparkles size={17} /></span>
            <p>{aiPlan
              ? <><strong>{aiPlan.summary}</strong> Results come from Hunt Planner API 1.1; OpenAI selected only validated filters and configured GIS services.{aiPlan.dateRange ? ` Date overlap applied for ${aiPlan.dateRange.start} through ${aiPlan.dateRange.end}.` : ''}{aiPlan.location ? ` Map location verified as ${aiPlan.location.label}.` : ''}</>
              : <><strong>Live catalog, AI-ready.</strong> Describe a hunt in plain language or use the filters. Hunt facts come directly from Hunt Planner API 1.1.</>}</p>
            <small>{aiPlan ? 'OpenAI + IDFG' : 'Source: IDFG'}</small>
          </aside>

          <div className="opportunity-list">
            {groupedOpportunities.map((group) => <div className="opportunity-group" key={group.label || 'all'}>
              {group.label && <h2 className="opportunity-group-title">{group.label}</h2>}
              {group.items.map((item) => (
              <article className={selectedHunt === item.id ? 'opportunity-card selected' : 'opportunity-card'} key={item.id}>
                <button className="card-hit-area" onClick={() => focusHuntArea(item)} aria-label={`Show ${item.tag}, ${item.areaLabel}, on map`} />
                <div className="unit-visual" style={{ '--unit-accent': item.kind === 'Controlled hunt' ? '#336f53' : '#536f3b' }}>
                  {selectedHunt === item.id && <b><MapPin size={12} />Selected on map</b>}
                  <span>{item.areaId ? 'Official hunt area' : item.unit ? 'GMU context' : 'Hunt area'}</span><strong className={(item.unit ?? 'IDFG').length > 3 ? 'long-unit' : ''}>{item.unit ?? 'IDFG'}</strong><small>{item.areaId ? `areaid ${item.areaId} · ` : ''}Hunt {item.id}</small>
                </div>
                <div className="unit-details">
                  <div className="unit-title-row"><div><span>{item.kind} · {item.areaLabel}</span><h2>{item.tag}</h2></div></div>
                  <div className="unit-facts"><span><CalendarDays size={15} />{item.dates}</span><span><Target size={15} />{item.method}</span><span><PawPrint size={15} />{item.sex}</span></div>
                  <div className="unit-tags"><span>{item.species}</span><span>{item.season}</span><span>{item.tagAvailability}</span>{item.unit && regionLookup.get(item.unit)?.map((region) => <span key={region}>{region}</span>)}</div>
                  <MatchExplanation hunt={item} plan={aiPlan} regionLookup={regionLookup} layers={allLayers} />
                  <div className="unit-footer"><span><Database size={14} />Hunt Planner API {item.apiVersion}</span><div className="unit-actions"><button className={isSaved(item.id) ? 'save-result saved' : 'save-result'} onClick={() => toggleSavedHunt(item.id)} aria-pressed={isSaved(item.id)}>{isSaved(item.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{isSaved(item.id) ? 'Saved' : 'Save'}</button><a href={`/hunt/${item.id}`} aria-label={`View details for ${item.tag}`}>View details <ChevronRight size={15} /></a></div></div>
                </div>
              </article>
              ))}
            </div>)}
            {apiState === 'ready' && opportunities.length === 0 && <div className="api-empty"><Search size={24} /><strong>No live hunts matched those filters.</strong><span>{filters.region.length && regionState === 'loading' ? 'Matching GMUs to live regional boundaries…' : 'Try broader species, hunt type, region, or search terms.'}</span></div>}
          </div>
        </section>

        <section className="search-map-pane" aria-label="Opportunity map">
          <arcgis-map ref={mapRef} basemap="topo" center={config.app.center.join(',')} zoom={config.app.zoom} onarcgisViewReadyChange={handleMapReady}>
            <arcgis-zoom slot="top-left" />
            <arcgis-locate slot="top-left" />
            <arcgis-scale-bar slot="bottom-left" unit="dual" />
          </arcgis-map>
          <LocationSummaryPopup summary={locationSummary} onClose={closeIdentify} onZoom={zoomToIdentify} />
          <div className="map-result-count"><MapPin size={16} /><strong>{resultTotal.toLocaleString()} opportunities</strong><span>from API 1.1</span></div>
          <aside className={stackOpen ? 'smart-stack is-open' : 'smart-stack'} aria-label="AI-selected map services">
            <button className="smart-stack-heading" onClick={() => setStackOpen(!stackOpen)} aria-expanded={stackOpen}>
              <span><Sparkles size={17} /><span><small>Search-derived</small><strong>{composedLayers.size} services on</strong></span></span>
              {stackOpen ? <X size={17} /> : <Layers3 size={18} />}
            </button>
            {stackOpen && <div className="smart-stack-body">
              <p>{aiPlan ? 'OpenAI interpreted your words; every selection is constrained to the configured service catalog.' : 'Selected from the service catalog using your words and filters—not a preset layer pack.'}</p>
              {rankedLayers.slice(0, 7).map((layer) => (
                <label className="smart-layer" key={layer.id}>
                  <span><strong>{layer.label}</strong><small>{layer.reason}</small></span>
                  <input type="checkbox" checked={composedLayers.has(layer.id)} onChange={() => toggleLayer(layer.id)} />
                </label>
              ))}
              <button className="catalog-button"><Filter size={15} />Browse full service catalog</button>
            </div>}
          </aside>
        </section>
      </main>
    </div>
  );
}

export default SearchPage;
