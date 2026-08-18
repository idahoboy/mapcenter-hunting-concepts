import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Car,
  ChevronDown,
  ChevronRight,
  Clock3,
  Filter,
  Layers3,
  MapPin,
  Mountain,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trees,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import config, { allLayers } from './config.js';
import { deriveLayerStack } from './layerIntelligence.js';
import { createLayer } from './mapLayers.js';
import SiteHeader from './SiteHeader.jsx';
import './search-page.css';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

const opportunities = [
  { unit: '39', title: 'Boise River Zone', region: 'Southwest', match: 96, drive: '42 min', access: 'Strong', terrain: 'Foothills', tags: ['Elk', 'Public access', 'Close to Boise'], accent: '#336f53' },
  { unit: '43', title: 'Sawtooth foothills', region: 'Magic Valley', match: 91, drive: '2 hr 18 min', access: 'Mixed', terrain: 'Alpine', tags: ['Elk', 'Wilderness nearby', 'Campgrounds'], accent: '#536f3b' },
  { unit: '48', title: 'Pioneer Mountains', region: 'Magic Valley', match: 87, drive: '2 hr 44 min', access: 'Strong', terrain: 'Mountain', tags: ['Elk', 'Public land', 'Steeper terrain'], accent: '#6f5b3b' },
  { unit: '22', title: 'Weiser River', region: 'Southwest', match: 82, drive: '1 hr 52 min', access: 'Mixed', terrain: 'Canyon', tags: ['Elk', 'Road access', 'Motor rules'], accent: '#785443' },
  { unit: '32A', title: 'Payette River', region: 'Southwest', match: 79, drive: '1 hr 31 min', access: 'Strong', terrain: 'Timber', tags: ['Elk', 'Access Yes!', 'Camp nearby'], accent: '#3e6260' },
];

const initialFilters = {
  species: 'Elk',
  season: 'Fall 2026',
  huntType: 'Any hunt type',
  access: 'Public access',
  terrain: 'Any terrain',
  travel: 'Within 3 hours',
};

function SearchPage() {
  const mapRef = useRef(null);
  const layerInstances = useRef(new Map());
  const highlightHandle = useRef(null);
  const [query, setQuery] = useState('Find a fall elk hunt within 3 hours of Boise with public access and fewer motor restrictions');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedUnit, setSelectedUnit] = useState('39');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [stackOpen, setStackOpen] = useState(
    () => !window.matchMedia('(max-width: 760px)').matches,
  );
  const [manualOverrides, setManualOverrides] = useState({});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [status, setStatus] = useState('Search assistant ready.');

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
    setStatus(`${composedLayers.size} services selected from the current search.`);
  };

  const optimizeMap = () => {
    setIsOptimizing(true);
    setManualOverrides({});
    setStatus('Analyzing the search and service catalog.');
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

  const focusUnit = async (unit) => {
    setSelectedUnit(unit);
    const layer = layerInstances.current.get('game-units');
    const view = mapRef.current?.view;
    if (!layer || !view) return;
    try {
      const response = await layer.queryFeatures({ where: `NAME = '${unit}'`, outFields: ['NAME', 'Elk_Zone'], returnGeometry: true });
      const feature = response.features[0];
      if (!feature) return;
      highlightHandle.current?.remove();
      const layerView = await view.whenLayerView(layer);
      highlightHandle.current = layerView.highlight(feature);
      await view.goTo(feature.geometry.extent.expand(1.7), { duration: 500 });
      setStatus(`Map centered on Game Management Unit ${unit}.`);
    } catch {
      setStatus(`Unit ${unit} selected. Map focus is temporarily unavailable.`);
    }
  };

  const filterOptions = {
    species: ['Elk', 'Deer', 'Pronghorn', 'Moose', 'Turkey'],
    season: ['Fall 2026', 'Spring 2027', 'Any season'],
    huntType: ['Any hunt type', 'General season', 'Controlled hunt'],
    access: ['Public access', 'Access Yes!', 'Any access'],
    terrain: ['Any terrain', 'Foothills', 'Mountain', 'Canyon'],
    travel: ['Within 3 hours', 'Within 90 minutes', 'Any distance'],
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
              <span>Describe the hunt you want</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && optimizeMap()} />
            </label>
            <button onClick={optimizeMap} disabled={isOptimizing}>
              <WandSparkles size={18} />{isOptimizing ? 'Optimizing…' : 'Optimize map'}
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
            <button className="all-filters-button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} />All filters</button>
          </div>
          {filtersOpen && (
            <div className="filter-summary-panel">
              <strong>More filters</strong>
              <button>Weapon or method</button><button>Draw odds</button><button>Harvest success</button><button>Road density</button><button>Elevation</button>
              <button className="close-inline" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={17} /></button>
            </div>
          )}
        </section>

        <section className="search-results-pane" id="search-results" aria-labelledby="results-title">
          <div className="results-toolbar">
            <div><a href="/"><ArrowLeft size={15} />Map center</a><h1 id="results-title">Hunt opportunities near Boise</h1><p>24 potential matches · ranked for your current criteria</p></div>
            <label>Sort by <select defaultValue="match"><option value="match">Best match</option><option value="drive">Drive time</option><option value="access">Public access</option></select></label>
          </div>

          <aside className="assistant-note">
            <span><Sparkles size={17} /></span>
            <p><strong>Map assistant</strong> combined your filters with available GIS service metadata. Review its layer reasoning on the map.</p>
            <small>Concept only</small>
          </aside>

          <div className="opportunity-list">
            {opportunities.map((item, index) => (
              <article className={selectedUnit === item.unit ? 'opportunity-card selected' : 'opportunity-card'} key={item.unit}>
                <button className="card-hit-area" onClick={() => focusUnit(item.unit)} aria-label={`Show Unit ${item.unit}, ${item.title}, on map`} />
                <div className="unit-visual" style={{ '--unit-accent': item.accent }}>
                  <span>GMU</span><strong>{item.unit}</strong><small>{item.region}</small>
                  {index === 0 && <b><BadgeCheck size={14} />Top match</b>}
                </div>
                <div className="unit-details">
                  <div className="unit-title-row"><div><span>Game Management Unit {item.unit}</span><h2>{item.title}</h2></div><strong className="match-score">{item.match}%<small>match</small></strong></div>
                  <div className="unit-facts"><span><Car size={15} />{item.drive}</span><span><Users size={15} />{item.access} access</span><span><Mountain size={15} />{item.terrain}</span></div>
                  <div className="unit-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className="unit-footer"><span><Clock3 size={14} />Services checked moments ago</span><span>View details <ChevronRight size={15} /></span></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="search-map-pane" aria-label="Opportunity map">
          <arcgis-map ref={mapRef} basemap="topo" center={config.app.center.join(',')} zoom={config.app.zoom} onarcgisViewReadyChange={handleMapReady}>
            <arcgis-zoom slot="top-left" />
            <arcgis-locate slot="top-left" />
            <arcgis-scale-bar slot="bottom-left" unit="dual" />
          </arcgis-map>
          <div className="map-result-count"><MapPin size={16} /><strong>24 matches</strong><span>in this map area</span></div>
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
