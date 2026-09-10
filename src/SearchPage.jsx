import { useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchHunts } from './huntPlannerApi.js';
import './search-page.css';
import './location-summary.css';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

const initialFilters = {
  species: 'Any species',
  season: '2026 seasons',
  huntType: 'Any hunt type',
};

function SearchPage() {
  const mapRef = useRef(null);
  const layerInstances = useRef(new Map());
  const highlightHandle = useRef(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedHunt, setSelectedHunt] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [apiState, setApiState] = useState('loading');
  const [stackOpen, setStackOpen] = useState(
    () => !window.matchMedia('(max-width: 760px)').matches,
  );
  const [manualOverrides, setManualOverrides] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [status, setStatus] = useState('Search assistant ready.');
  const { summary: locationSummary, attach: attachIdentify, close: closeIdentify, zoomTo: zoomToIdentify } = useMapIdentify(layerInstances, allLayers);
  const { isSaved, toggle: toggleSavedHunt } = useHuntPlan();

  useEffect(() => {
    let active = true;
    setApiState('loading');
    fetchHunts({
      search: submittedQuery,
      species: filters.species === 'Any species' ? '' : filters.species,
      huntType: filters.huntType,
    }).then((result) => {
      if (!active) return;
      setOpportunities(result.rows);
      setResultTotal(result.total);
      setApiState('ready');
      setStatus(`${result.total.toLocaleString()} live opportunities returned by Hunt Planner API 1.1.`);
    }).catch(() => {
      if (!active) return;
      setApiState('error');
      setStatus('Hunt Planner API 1.1 is temporarily unavailable.');
    });
    return () => { active = false; };
  }, [submittedQuery, filters.species, filters.huntType]);

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

  const optimizeMap = () => {
    setIsOptimizing(true);
    setManualOverrides({});
    setSubmittedQuery(query.trim());
    setStatus('Searching Hunt Planner API 1.1 and analyzing the service catalog.');
    window.setTimeout(() => {
      setIsOptimizing(false);
      setStackOpen(true);
      setStatus(`${composedLayers.size} services selected. Layer reasoning is available on the map.`);
    }, 650);
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setManualOverrides({});
  };

  const toggleLayer = (id) => {
    const next = !composedLayers.has(id);
    setManualOverrides((current) => ({ ...current, [id]: next }));
    setStatus(`${allLayers.find((layer) => layer.id === id)?.label} manually turned ${next ? 'on' : 'off'}.`);
  };

  const focusUnit = async (item) => {
    setSelectedHunt(item.id);
    const layer = layerInstances.current.get('game-units');
    const view = mapRef.current?.view;
    if (!layer || !view || !item.unit) {
      setStatus(`${item.areaLabel} does not resolve to a single game management unit.`);
      return;
    }
    try {
      const mapUnit = item.unit;
      const response = await layer.queryFeatures({ where: `NAME = '${mapUnit}'`, outFields: ['NAME', 'Elk_Zone'], returnGeometry: true });
      const feature = response.features[0];
      if (!feature) return;
      highlightHandle.current?.remove();
      const layerView = await view.whenLayerView(layer);
      highlightHandle.current = layerView.highlight(feature);
      await view.goTo(feature.geometry.extent.expand(1.7), { duration: 500 });
      setStatus(`Map centered on Game Management Unit ${mapUnit}.`);
    } catch {
      setStatus(`${item.areaLabel} selected. Map focus is temporarily unavailable.`);
    }
  };

  const filterOptions = {
    species: ['Any species', 'Elk', 'Deer', 'Pronghorn', 'Black Bear', 'Moose', 'Turkey'],
    season: ['2026 seasons'],
    huntType: ['Any hunt type', 'General season', 'Controlled hunt'],
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
              <span>Search live hunts by tag, area, or name</span>
              <input value={query} placeholder="Try 30A-1, bear, or Pioneer" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && optimizeMap()} />
            </label>
            <button onClick={optimizeMap} disabled={isOptimizing}>
              <WandSparkles size={18} />{isOptimizing ? 'Searching…' : 'Search & map'}
            </button>
          </div>
          <div className="filter-strip" aria-label="Search filters">
            {Object.entries(filterOptions).map(([key, options]) => (
              <label className="filter-chip" key={key}>
                <span className="sr-only">{key}</span>
                <select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}>
                  {options.map((option) => <option key={option}>{option}</option>)}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
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
            <p><strong>Live catalog, map-assisted.</strong> Hunt facts come directly from Hunt Planner API 1.1; the map composes available GIS services around those results.</p>
            <small>Source: IDFG</small>
          </aside>

          <div className="opportunity-list">
            {opportunities.map((item) => (
              <article className={selectedHunt === item.id ? 'opportunity-card selected' : 'opportunity-card'} key={item.id}>
                <button className="card-hit-area" onClick={() => focusUnit(item)} aria-label={`Show ${item.tag}, ${item.areaLabel}, on map`} />
                <div className="unit-visual" style={{ '--unit-accent': item.kind === 'Controlled hunt' ? '#336f53' : '#536f3b' }}>
                  <span>{item.unit ? 'GMU context' : 'Hunt area'}</span><strong className={(item.unit ?? 'IDFG').length > 3 ? 'long-unit' : ''}>{item.unit ?? 'IDFG'}</strong><small>Hunt {item.id}</small>
                </div>
                <div className="unit-details">
                  <div className="unit-title-row"><div><span>{item.kind} · {item.areaLabel}</span><h2>{item.tag}</h2></div></div>
                  <div className="unit-facts"><span><CalendarDays size={15} />{item.dates}</span><span><Target size={15} />{item.method}</span><span><PawPrint size={15} />{item.sex}</span></div>
                  <div className="unit-tags"><span>{item.species}</span><span>{item.season}</span><span>{item.tagAvailability}</span></div>
                  <div className="unit-footer"><span><Database size={14} />Hunt Planner API {item.apiVersion}</span><div className="unit-actions"><button className={isSaved(item.id) ? 'save-result saved' : 'save-result'} onClick={() => toggleSavedHunt(item.id)} aria-pressed={isSaved(item.id)}>{isSaved(item.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{isSaved(item.id) ? 'Saved' : 'Save'}</button><a href={`/hunt/${item.id}`} aria-label={`View details for ${item.tag}`}>View details <ChevronRight size={15} /></a></div></div>
                </div>
              </article>
            ))}
            {apiState === 'ready' && opportunities.length === 0 && <div className="api-empty"><Search size={24} /><strong>No live hunts matched those filters.</strong><span>Try a broader species, hunt type, or search term.</span></div>}
          </div>
        </section>

        <section className="search-map-pane" aria-label="Opportunity map">
          <arcgis-map ref={mapRef} basemap="topo" center={config.app.center.join(',')} zoom={config.app.zoom} onarcgisViewReadyChange={handleMapReady}>
            <arcgis-zoom slot="top-left" />
            <arcgis-locate slot="top-left" />
            <arcgis-scale-bar slot="bottom-left" unit="dual" />
          </arcgis-map>
          <LocationSummaryPopup summary={locationSummary} onClose={closeIdentify} onZoom={zoomToIdentify} />
          <div className="map-result-count"><MapPin size={16} /><strong>{resultTotal.toLocaleString()} hunts</strong><span>from API 1.1</span></div>
          <aside className={stackOpen ? 'smart-stack is-open' : 'smart-stack'} aria-label="AI-selected map services">
            <button className="smart-stack-heading" onClick={() => setStackOpen(!stackOpen)} aria-expanded={stackOpen}>
              <span><Sparkles size={17} /><span><small>Search-derived</small><strong>{composedLayers.size} services on</strong></span></span>
              {stackOpen ? <X size={17} /> : <Layers3 size={18} />}
            </button>
            {stackOpen && <div className="smart-stack-body">
              <p>Selected from the service catalog using your words and filters—not a preset layer pack.</p>
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
