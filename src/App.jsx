import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bird,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Layers3,
  Map as MapIcon,
  Moon,
  Navigation,
  PawPrint,
  Route,
  Search,
  SlidersHorizontal,
  Sun,
  Trees,
  Waves,
  X,
} from 'lucide-react';
import config, { allLayers } from './config.js';
import { createLayer } from './mapLayers.js';
import SearchPage from './SearchPage.jsx';
import SiteHeader from './SiteHeader.jsx';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-search';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

const activityIcons = {
  bird: Bird,
  deer: Trees,
  paw: PawPrint,
  route: Route,
  waves: Waves,
};

const initialLayerState = Object.fromEntries(
  allLayers.map((layer) => [layer.id, Boolean(layer.defaultVisible)]),
);

function PlannerPage() {
  const mapRef = useRef(null);
  const layerInstances = useRef(new Map());
  const [activeActivity, setActiveActivity] = useState('big-game');
  const [layersOpen, setLayersOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [layerSearch, setLayerSearch] = useState('');
  const [layerState, setLayerState] = useState(initialLayerState);
  const [expandedGroups, setExpandedGroups] = useState(
    Object.fromEntries(config.layerGroups.map((group) => [group.id, true])),
  );
  const [basemap, setBasemap] = useState(config.app.defaultBasemap);
  const [theme, setTheme] = useState('light');
  const [largeText, setLargeText] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [status, setStatus] = useState('Loading Idaho map services…');

  const activeLayerCount = Object.values(layerState).filter(Boolean).length;
  const activeActivityData = config.activities.find((item) => item.id === activeActivity);

  const filteredGroups = useMemo(() => {
    const query = layerSearch.trim().toLowerCase();
    if (!query) return config.layerGroups;
    return config.layerGroups
      .map((group) => ({
        ...group,
        layers: group.layers.filter((layer) =>
          `${layer.label} ${layer.description}`.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.layers.length);
  }, [layerSearch]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.textSize = largeText ? 'large' : 'default';
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [theme, largeText, reducedMotion]);

  const handleMapReady = (event) => {
    const mapElement = event.target;
    if (!mapElement?.map || layerInstances.current.size) return;

    allLayers.forEach((definition) => {
      const layer = createLayer(definition);
      layerInstances.current.set(definition.id, layer);
      mapElement.map.add(layer);
    });

    if (mapElement.view) {
      mapElement.view.aria = {
        label: 'Interactive Idaho hunt planning map',
        description:
          'Explore game units, hunt boundaries, restrictions, public access, and land-management context.',
      };
      mapElement.view.constraints = { geometry: { type: 'extent', xmin: -118.2, ymin: 41.6, xmax: -110.2, ymax: 49.2 } };
    }

    setStatus(`${activeLayerCount} map layers are on.`);
  };

  const toggleLayer = (id) => {
    const nextVisible = !layerState[id];
    const layer = layerInstances.current.get(id);
    if (layer) layer.visible = nextVisible;
    setLayerState((current) => ({ ...current, [id]: nextVisible }));
    const label = allLayers.find((item) => item.id === id)?.label ?? 'Layer';
    setStatus(`${label} turned ${nextVisible ? 'on' : 'off'}.`);
  };

  const selectActivity = (activity) => {
    setActiveActivity(activity.id);
    const suggested = new Set(activity.suggestedLayers);
    const nextState = { ...layerState };
    allLayers.forEach((definition) => {
      const shouldShow = suggested.has(definition.id);
      nextState[definition.id] = shouldShow;
      const instance = layerInstances.current.get(definition.id);
      if (instance) instance.visible = shouldShow;
    });
    setLayerState(nextState);
    setStatus(`${activity.label} planning view selected. ${suggested.size} suggested layers are on.`);
  };

  const changeBasemap = (nextBasemap) => {
    setBasemap(nextBasemap);
    if (mapRef.current) mapRef.current.basemap = nextBasemap;
    setStatus(`${config.basemaps.find((item) => item.id === nextBasemap)?.label} basemap selected.`);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#planner-map">Skip to interactive map</a>
      <p className="sr-only" aria-live="polite">{status}</p>

      <SiteHeader activeView="map" onDisplay={() => setAccessOpen(!accessOpen)} displayExpanded={accessOpen}>
        {accessOpen && (
          <section id="accessibility-panel" className="accessibility-panel" aria-label="Display and accessibility settings">
            <div className="panel-heading"><div><span className="eyebrow">Display</span><h2>Make it yours</h2></div><button className="close-button" onClick={() => setAccessOpen(false)} aria-label="Close display settings"><X /></button></div>
            <label className="setting-row"><span><strong>High-contrast theme</strong><small>Increase foreground contrast</small></span><input type="checkbox" checked={theme === 'contrast'} onChange={(e) => setTheme(e.target.checked ? 'contrast' : 'light')} /></label>
            <label className="setting-row"><span><strong>Larger interface text</strong><small>Increase labels and controls</small></span><input type="checkbox" checked={largeText} onChange={(e) => setLargeText(e.target.checked)} /></label>
            <label className="setting-row"><span><strong>Reduce motion</strong><small>Limit animated transitions</small></span><input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} /></label>
          </section>
        )}
      </SiteHeader>

      <main className="planner" id="top">
        <section className="planning-panel" aria-labelledby="planner-title">
          <div className="intro-block">
            <span className="eyebrow">Plan with confidence</span>
            <h1 id="planner-title">Find your place in Idaho</h1>
            <p>Choose what you want to do, then explore boundaries, access, and terrain together.</p>
          </div>

          <div className="activity-section">
            <div className="section-label"><span>1</span><h2>What are you planning?</h2></div>
            <div className="activity-grid">
              {config.activities.map((activity) => {
    const Icon = activityIcons[activity.icon] ?? MapIcon;
                const selected = activity.id === activeActivity;
                return (
                  <button
                    key={activity.id}
                    className={selected ? 'activity-card selected' : 'activity-card'}
                    style={{ '--activity-accent': activity.accent }}
                    onClick={() => selectActivity(activity)}
                    aria-pressed={selected}
                  >
                    <span className="activity-icon"><Icon size={20} /></span>
                    <span><strong>{activity.label}</strong><small>{activity.description}</small></span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="plan-form" aria-label="Hunt planning search">
            <div className="section-label"><span>2</span><h2>Narrow the map</h2></div>
            <div className="field-row">
              <label><span>Species</span><select defaultValue="elk"><option value="elk">Elk</option><option value="deer">Deer</option><option value="pronghorn">Pronghorn</option><option value="moose">Moose</option><option value="turkey">Turkey</option></select></label>
              <label><span>Season</span><select defaultValue="any"><option value="any">Any season</option><option value="spring">Spring</option><option value="fall">Fall</option></select></label>
            </div>
            <label className="location-field"><span>Unit, place, or coordinates</span><div><Search size={19} /><input type="search" placeholder="Try Unit 39 or Salmon, Idaho" /></div></label>
            <button className="primary-button" onClick={() => setStatus('Search controls are ready for rules and season API integration.')}><Navigation size={18} />Explore the map</button>
          </div>

          <aside className="trust-note"><CircleHelp size={18} /><p><strong>Planning aid, not the legal record.</strong> {config.app.disclaimer}</p></aside>
        </section>

        <section className="map-stage" id="planner-map" aria-label="Map center">
          <arcgis-map
            ref={mapRef}
            basemap={basemap}
            center={config.app.center.join(',')}
            zoom={config.app.zoom}
            onarcgisViewReadyChange={handleMapReady}
          >
            <arcgis-zoom slot="top-left" />
            <arcgis-locate slot="top-left" />
            <arcgis-scale-bar slot="bottom-left" unit="dual" />
          </arcgis-map>

          <div className="map-search"><arcgis-search include-default-sources="true" /></div>
          <div className="map-actions" aria-label="Map controls">
            <button className={layersOpen ? 'map-action active' : 'map-action'} onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen} aria-controls="layer-panel"><Layers3 size={20} /><span>Layers</span><b>{activeLayerCount}</b></button>
            <label className="basemap-control"><span className="sr-only">Basemap</span><MapIcon size={18} /><select value={basemap} onChange={(event) => changeBasemap(event.target.value)}>{config.basemaps.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>

          <div className="map-context-card">
            <span className="context-icon" style={{ background: activeActivityData.accent }}><Layers3 size={18} /></span>
            <span><small>Planning view</small><strong>{activeActivityData.label}</strong></span>
            <button onClick={() => setLayersOpen(true)}>Refine</button>
          </div>

          <aside id="layer-panel" className={layersOpen ? 'layer-panel is-open' : 'layer-panel'} aria-label="Map layers" aria-hidden={!layersOpen}>
            <div className="panel-heading"><div><span className="eyebrow">Map content</span><h2>Layers</h2></div><button className="close-button" onClick={() => setLayersOpen(false)} aria-label="Close layers"><X /></button></div>
            <label className="layer-search"><Search size={18} /><span className="sr-only">Search layers</span><input value={layerSearch} onChange={(event) => setLayerSearch(event.target.value)} type="search" placeholder="Search layers" /></label>
            <div className="layer-groups">
              {filteredGroups.map((group) => (
                <section className="layer-group" key={group.id}>
                  <button className="group-heading" onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))} aria-expanded={expandedGroups[group.id]}>
                    <span><strong>{group.label}</strong><small>{group.description}</small></span>{expandedGroups[group.id] ? <ChevronDown /> : <ChevronRight />}
                  </button>
                  {expandedGroups[group.id] && <div className="group-layers">{group.layers.map((layer) => (
                    <label className="layer-row" key={layer.id}><span><strong>{layer.label}</strong><small>{layer.description}</small></span><input type="checkbox" checked={layerState[layer.id]} onChange={() => toggleLayer(layer.id)} /></label>
                  ))}</div>}
                </section>
              ))}
            </div>
          </aside>
        </section>
      </main>

      <footer className="mobile-dock" aria-label="Planner shortcuts">
        <button className="active"><MapIcon size={20} /><span>Map</span></button>
        <button onClick={() => setLayersOpen(true)}><Layers3 size={20} /><span>Layers</span></button>
        <button><SlidersHorizontal size={20} /><span>Plan</span></button>
        <button onClick={() => setAccessOpen(true)}>{theme === 'contrast' ? <Moon size={20} /> : <Sun size={20} />}<span>Display</span></button>
      </footer>
    </div>
  );
}

function App() {
  return window.location.pathname.startsWith('/search') ? <SearchPage /> : <PlannerPage />;
}

export default App;
