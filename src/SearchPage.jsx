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
import { filterOpportunities, filterOverlappingOpportunities, matchesDateRange } from './opportunityFilters.js';
import { fetchRegionLookup, REGION_NAMES } from './regionContext.js';
import { createFallbackOpportunityPlan, interpretOpportunitySearch, resolveCatalogSearch } from './aiOpportunitySearch.js';
import MatchExplanation from './MatchExplanation.jsx';
import { buildUnitWhereClause, getCombinedExtent, getHuntMapUnits } from './huntMapSelection.js';
import { createProximityBuffer, findIntersectingOpportunityIds } from './spatialOpportunityFilter.js';
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

const monthOptions = [
  { label: 'August', month: 8 },
  { label: 'September', month: 9 },
  { label: 'October', month: 10 },
  { label: 'November', month: 11 },
  { label: 'December', month: 12 },
];

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

const groupDescriptor = (hunt, mode) => {
  if (mode === 'location') {
    return hunt.areaId
      ? { key: `area:${hunt.areaId}`, label: `${hunt.areaLabel || `Unit ${hunt.unit}`} · Hunt area ${hunt.areaId}` }
      : { key: `unit:${hunt.unit || 'unspecified'}`, label: hunt.unit ? `Unit ${hunt.unit}` : 'Unspecified location' };
  }
  if (mode === 'tag') {
    return hunt.opGroupId
      ? { key: `opgroup:${hunt.opGroupId}`, label: `${hunt.tag || 'Tag'} · Tag group ${hunt.opGroupId}` }
      : { key: `tag:${hunt.tag || 'unspecified'}`, label: hunt.tag || 'Unspecified tag' };
  }
  const value = mode === 'sex' ? hunt.sex : mode === 'species' ? hunt.species : hunt.method;
  return { key: `${mode}:${value || 'unspecified'}`, label: value || 'Unspecified' };
};

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

function PrimaryDecision({ number, question, children }) {
  return (
    <div className="primary-decision">
      <span>{number}</span>
      <div><small>{question}</small>{children}</div>
    </div>
  );
}

function AreaResult({ group, selectedHunt, focusHuntArea, isSaved, toggleSavedHunt, regionLookup }) {
  const representative = group.items[0];
  const tagGroups = new Map();
  group.items.forEach((hunt) => {
    const key = hunt.opGroupId ? `opgroup:${hunt.opGroupId}` : `tag:${hunt.tag}`;
    if (!tagGroups.has(key)) tagGroups.set(key, { key, label: hunt.tag || 'Unnamed tag', opGroupId: hunt.opGroupId, items: [] });
    tagGroups.get(key).items.push(hunt);
  });
  const tags = [...tagGroups.values()].sort((a, b) => alphaCompare(a.label, b.label));
  const regions = representative.unit ? regionLookup.get(representative.unit) ?? [] : [];
  const openingDates = [...group.items].sort((a, b) => dateValue(a) - dateValue(b));
  return (
    <details className="area-result-group">
      <summary>
        <span className="area-result-number">{representative.unit || 'ID'}</span>
        <span className="area-result-title"><small>Hunt area</small><strong>{representative.areaLabel || `Unit ${representative.unit}`}</strong><span>{regions.join(' · ') || 'Idaho'}</span></span>
        <span className="area-result-count"><strong>{tags.length}</strong> tag {tags.length === 1 ? 'permission' : 'permissions'}<small>{group.items.length} season {group.items.length === 1 ? 'option' : 'options'}</small></span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="area-result-context">
        <span><CalendarDays size={14} aria-hidden="true" />{openingDates[0]?.dates || 'Dates unavailable'}</span>
        <button type="button" onClick={() => focusHuntArea(representative)}><MapPin size={14} aria-hidden="true" />Highlight and zoom</button>
      </div>
      <div className="area-tag-list">
        {tags.map((tag) => (
          <section key={tag.key} className="area-tag-row">
            <div><span>Tag permission</span><strong>{tag.label}</strong><small>{tag.opGroupId ? `opgroup ${tag.opGroupId} · ` : ''}{tag.items.length} season {tag.items.length === 1 ? 'option' : 'options'}</small></div>
            <div className="area-season-options">
              {tag.items.sort((a, b) => dateValue(a) - dateValue(b)).map((item) => (
                <article className={selectedHunt === item.id ? 'area-season-option selected' : 'area-season-option'} key={item.id}>
                  <button type="button" className="area-season-focus" onClick={() => focusHuntArea(item)}>
                    <strong>{item.dates}</strong><span>{item.method} · {item.sex}</span>
                  </button>
                  <button type="button" className="area-season-save" onClick={() => toggleSavedHunt(item.id)} aria-pressed={isSaved(item.id)} aria-label={`${isSaved(item.id) ? 'Remove' : 'Save'} hunt ${item.id}`}>
                    {isSaved(item.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  </button>
                  <a href={`/hunt/${item.id}`} aria-label={`View details for hunt ${item.id}`}><ChevronRight size={16} /></a>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

function OpportunityGroupHeading({ group, mode }) {
  if (mode !== 'tag') {
    return <h2 className="opportunity-group-title"><span>{group.label}</span><small>{group.items.length} {group.items.length === 1 ? 'opportunity' : 'opportunities'}</small></h2>;
  }

  const representative = group.items[0];
  const areaCount = new Set(group.items.map((hunt) => hunt.areaId ? `area:${hunt.areaId}` : `unit:${hunt.unit || hunt.areaLabel}`)).size;
  const species = [...new Set(group.items.map((hunt) => hunt.species).filter(Boolean))];
  const methods = [...new Set(group.items.map((hunt) => hunt.method).filter(Boolean))];
  return (
    <header className="tag-group-header">
      <div>
        <span className="tag-group-eyebrow"><Bookmark size={14} aria-hidden="true" />Tag permission</span>
        <h2>{representative.tag || 'Unnamed tag'}</h2>
        <p>{group.items.length} season {group.items.length === 1 ? 'opportunity' : 'opportunities'} across {areaCount} hunt {areaCount === 1 ? 'area' : 'areas'}</p>
      </div>
      <div className="tag-group-summary" aria-label="Tag group summary">
        {species.map((value) => <span key={value}>{value}</span>)}
        {methods.map((value) => <span key={value}>{value}</span>)}
        {representative.opGroupId && <small>opgroup {representative.opGroupId}</small>}
      </div>
    </header>
  );
}

function TagPermissionResult({ group, selectedHunt, focusHuntArea, isSaved, toggleSavedHunt }) {
  const representative = group.items[0];
  const areaCount = new Set(group.items.map((hunt) => hunt.areaId ? `area:${hunt.areaId}` : `unit:${hunt.unit || hunt.areaLabel}`)).size;
  const species = [...new Set(group.items.map((hunt) => hunt.species).filter(Boolean))];
  return (
    <details className="tag-result-group">
      <summary>
        <span className="tag-result-mark"><Bookmark size={16} aria-hidden="true" /></span>
        <span className="tag-result-title">
          <small>Tag permission</small>
          <strong>{representative.tag || 'Unnamed tag'}</strong>
          <span>{species.join(' · ')}</span>
        </span>
        <span className="tag-result-count"><strong>{group.items.length}</strong> season {group.items.length === 1 ? 'option' : 'options'}<small>{areaCount} hunt {areaCount === 1 ? 'area' : 'areas'}</small></span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="tag-season-list">
        {group.items.map((item) => (
          <article className={selectedHunt === item.id ? 'tag-season-row selected' : 'tag-season-row'} key={item.id}>
            <button className="tag-season-hit" type="button" onClick={() => focusHuntArea(item)} aria-label={`Show ${item.tag}, ${item.areaLabel}, on map`} />
            <span className="tag-season-area"><strong>{item.areaLabel}</strong><small>{item.areaId ? `areaid ${item.areaId}` : item.unit ? `GMU ${item.unit}` : 'Area unavailable'} · Hunt {item.id}</small></span>
            <span><CalendarDays size={14} aria-hidden="true" />{item.dates}</span>
            <span><Target size={14} aria-hidden="true" />{item.method}</span>
            <span><PawPrint size={14} aria-hidden="true" />{item.sex}</span>
            <span className="tag-season-availability">{item.tagAvailability}</span>
            <span className="tag-season-actions">
              <button type="button" onClick={() => toggleSavedHunt(item.id)} aria-pressed={isSaved(item.id)} aria-label={`${isSaved(item.id) ? 'Remove' : 'Save'} hunt ${item.id}`}>
                {isSaved(item.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              </button>
              <a href={`/hunt/${item.id}`} aria-label={`View details for ${item.tag}, hunt ${item.id}`}><ChevronRight size={17} /></a>
            </span>
          </article>
        ))}
      </div>
      {representative.opGroupId && <small className="tag-result-source">Hunt Planner API 1.1 · opgroup {representative.opGroupId}</small>}
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
  const proximityGraphic = useRef(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedHunt, setSelectedHunt] = useState(null);
  const [groupBy, setGroupBy] = useState('location');
  const [sortBy, setSortBy] = useState('alpha');
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [hasViewedResults, setHasViewedResults] = useState(false);
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
  const [spatialMatchIds, setSpatialMatchIds] = useState(null);
  const [proximityState, setProximityState] = useState('idle');
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
    if (view && proximityGraphic.current) view.graphics.remove(proximityGraphic.current);
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

  const overlapQuery = /\b(overlap|overlapping|same location|same area)\b/i.test(query);
  const attributeFilteredOpportunities = useMemo(
    () => {
      const rows = filterOpportunities(catalog, { search: submittedQuery, filters, regionLookup, dateRange: aiPlan?.dateRange });
      const monthFiltered = selectedMonths.length
        ? rows.filter((hunt) => selectedMonths.some((month) => matchesDateRange(hunt, {
          start: `2026-${String(month).padStart(2, '0')}-01`,
          end: `2026-${String(month).padStart(2, '0')}-${new Date(2026, month, 0).getDate()}`,
        })))
        : rows;
      return overlapQuery ? filterOverlappingOpportunities(monthFiltered) : monthFiltered;
    },
    [catalog, submittedQuery, filters, regionLookup, aiPlan, overlapQuery, selectedMonths],
  );
  useEffect(() => {
    let active = true;
    const view = mapRef.current?.view;
    if (view && proximityGraphic.current) {
      view.graphics.remove(proximityGraphic.current);
      proximityGraphic.current = null;
    }
    if (!aiPlan?.location || !aiPlan?.proximity) {
      setSpatialMatchIds(null);
      setProximityState('idle');
      return () => { active = false; };
    }
    setProximityState('loading');
    setSpatialMatchIds(null);
    setStatus(`Applying a ${aiPlan.proximity.radiusMiles}-mile GIS buffer around ${aiPlan.location.label}.`);
    createProximityBuffer(aiPlan.location, aiPlan.proximity.radiusMiles)
      .then(async (buffer) => {
        if (!buffer || !active) return;
        if (view) {
          proximityGraphic.current = new Graphic({
            geometry: buffer,
            symbol: { type: 'simple-fill', color: [196, 84, 38, 0.12], outline: { color: [156, 72, 34, 0.9], width: 2 } },
            popupTemplate: null,
          });
          view.graphics.add(proximityGraphic.current);
          view.goTo(buffer.extent.expand(1.08), { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550 }).catch(() => {});
        }
        const ids = await findIntersectingOpportunityIds(attributeFilteredOpportunities, buffer);
        if (!active) return;
        setSpatialMatchIds(ids);
        setProximityState('ready');
        setStatus(`${ids.size} opportunities intersect the ${aiPlan.proximity.radiusMiles}-mile planning buffer.`);
      })
      .catch(() => {
        if (!active) return;
        setSpatialMatchIds(new Set());
        setProximityState('error');
        setStatus('The GIS proximity filter could not be completed.');
      });
    return () => { active = false; };
  }, [aiPlan, attributeFilteredOpportunities]);
  const filteredOpportunities = useMemo(() => spatialMatchIds
    ? attributeFilteredOpportunities.filter((hunt) => spatialMatchIds.has(hunt.id))
    : attributeFilteredOpportunities, [attributeFilteredOpportunities, spatialMatchIds]);
  const resultTotal = filteredOpportunities.length;
  const resultAreaTotal = useMemo(() => new Set(filteredOpportunities.map((hunt) => hunt.areaId ? `area:${hunt.areaId}` : `unit:${hunt.unit || hunt.areaLabel}`)).size, [filteredOpportunities]);
  const sortedOpportunities = useMemo(() => sortOpportunities(filteredOpportunities, sortBy), [filteredOpportunities, sortBy]);
  const groupedOpportunities = useMemo(() => {
    const pageSize = config.dataProviders.huntPlanner.pageSize;
    if (groupBy === 'none') {
      return [{ key: 'all', label: null, items: sortedOpportunities.slice(0, pageSize) }];
    }
    const groups = new Map();
    sortedOpportunities.forEach((hunt) => {
      const descriptor = groupDescriptor(hunt, groupBy);
      if (!groups.has(descriptor.key)) groups.set(descriptor.key, { ...descriptor, items: [] });
      groups.get(descriptor.key).items.push(hunt);
    });
    const orderedGroups = [...groups.values()];
    if (sortBy === 'alpha') orderedGroups.sort((a, b) => alphaCompare(a.label, b.label));
    return orderedGroups.slice(0, pageSize);
  }, [sortedOpportunities, groupBy, sortBy]);
  const opportunities = useMemo(() => groupedOpportunities.flatMap((group) => group.items), [groupedOpportunities]);
  const receipt = useMemo(() => [
    { label: 'What', value: filters.species.length ? filters.species.join(', ') : 'Any big game' },
    { label: 'Where', value: aiPlan?.location?.label || (filters.region.length ? filters.region.join(', ') : 'Anywhere in Idaho') },
    { label: 'When', value: aiPlan?.dateRange ? `${aiPlan.dateRange.start}–${aiPlan.dateRange.end}` : selectedMonths.length ? monthOptions.filter((item) => selectedMonths.includes(item.month)).map((item) => item.label).join(', ') : 'Any open date' },
    { label: 'Hunt type', value: filters.huntType.length ? filters.huntType.join(', ') : 'General or controlled' },
  ], [filters.species, filters.region, filters.huntType, aiPlan, selectedMonths]);

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
      setHasViewedResults(true);
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
      setHasViewedResults(true);
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
      setHasViewedResults(true);
      setStatus(fallback.summary);
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateFilter = (key, values) => {
    setFilters((current) => ({ ...current, [key]: values }));
    setManualOverrides({});
  };

  const revealFilteredResults = () => {
    setHasViewedResults(true);
    setStatus(`${resultTotal.toLocaleString()} filtered Hunt Planner opportunities shown.`);
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
          <div className="primary-decisions" aria-label="Primary search decisions">
            <PrimaryDecision number="1" question="What">
              <MultiSelectFilter label="Any big game" options={activeFilterOptions.species.options} selected={filters.species} onChange={(values) => updateFilter('species', values)} />
            </PrimaryDecision>
            <PrimaryDecision number="2" question="Where">
              <MultiSelectFilter label="Anywhere in Idaho" options={activeFilterOptions.region.options} selected={filters.region} onChange={(values) => updateFilter('region', values)} />
            </PrimaryDecision>
            <PrimaryDecision number="3" question="When">
              <MultiSelectFilter label="Any open date" options={monthOptions.map((item) => item.label)} selected={monthOptions.filter((item) => selectedMonths.includes(item.month)).map((item) => item.label)} onChange={(values) => setSelectedMonths(monthOptions.filter((item) => values.includes(item.label)).map((item) => item.month))} />
            </PrimaryDecision>
            <PrimaryDecision number="4" question="Hunt type">
              <MultiSelectFilter label="General or controlled" options={activeFilterOptions.huntType.options} selected={filters.huntType} onChange={(values) => updateFilter('huntType', values)} />
            </PrimaryDecision>
          </div>

          <details className="refine-search">
            <summary><Filter size={15} aria-hidden="true" />Refine with weapon, sex or ornament<ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="filter-strip" aria-label="Additional search refinements">
              <MultiSelectFilter label="Weapon / method" options={activeFilterOptions.season.options} selected={filters.season} onChange={(values) => updateFilter('season', values)} />
              <MultiSelectFilter label="Sex / ornament" options={activeFilterOptions.sex.options} selected={filters.sex} onChange={(values) => updateFilter('sex', values)} />
            </div>
          </details>

          <div className="search-receipt" aria-label="Current search" aria-live="polite">
            <span className="search-receipt-label">Your search</span>
            {receipt.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}
          </div>

          <div className="search-gate-actions">
            <p><strong>{apiState === 'loading' ? 'Checking live opportunities…' : `${resultAreaTotal.toLocaleString()} hunt areas ready`}</strong><span>{resultTotal.toLocaleString()} live season opportunities match this search.</span></p>
            <button type="button" onClick={revealFilteredResults} disabled={apiState === 'loading'} aria-controls="search-results">
              {hasViewedResults ? `Update ${resultAreaTotal.toLocaleString()} areas` : `Explore ${resultAreaTotal.toLocaleString()} areas`}<ChevronRight size={17} />
            </button>
          </div>

        </section>

        <section className="search-results-pane" id="search-results" aria-labelledby="results-title">
          {!hasViewedResults ? <div className="pre-results-panel">
            <span>Opportunity Explorer</span>
            <h1 id="results-title">Start with a place—not a record.</h1>
            <p>Use the four decisions above or describe what you want. We’ll show matching hunt areas first, then reveal the tag permissions and seasons available there.</p>
          </div> : <>
          <div className="results-toolbar">
            <div><a href="/"><ArrowLeft size={15} />Map center</a><h1 id="results-title">2026 hunt opportunities</h1><p>{apiState === 'loading' ? 'Loading Hunt Planner API 1.1…' : apiState === 'error' ? 'Live data is temporarily unavailable' : groupBy === 'location' ? `${resultAreaTotal.toLocaleString()} matching hunt areas · showing first ${groupedOpportunities.length}` : groupBy === 'tag' ? `${resultTotal.toLocaleString()} authoritative opportunities · ${groupedOpportunities.length} tag permissions shown` : `${resultTotal.toLocaleString()} authoritative records · showing first ${opportunities.length}`}</p></div>
            <span className="live-data-badge"><Database size={14} />API 1.1 live</span>
          </div>

          <details className="organize-disclosure">
            <summary>Organize results <ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="result-view-controls" aria-label="Result organization">
              <label>
                <span>Group results by</span>
                <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
                  <option value="none">No grouping</option>
                  <option value="tag">Tag permission</option>
                  <option value="location">Hunt area</option>
                  <option value="sex">Sex / ornament</option>
                  <option value="species">Species</option>
                  <option value="weapon">Weapon / method</option>
                </select>
              </label>
              <label>
                <span>Sort within groups by</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="alpha">Area / unit A–Z</option>
                  <option value="date">Opening date</option>
                  <option value="tag">Tag A–Z</option>
                  <option value="sex">Sex / ornament A–Z</option>
                  <option value="species">Species A–Z</option>
                  <option value="weapon">Weapon / method A–Z</option>
                </select>
              </label>
            </div>
          </details>

          <aside className="assistant-note">
            <span><Sparkles size={17} /></span>
            <p>{aiPlan
              ? <><strong>{aiPlan.summary}</strong> Results come from Hunt Planner API 1.1; OpenAI selected only validated filters and configured GIS services.{aiPlan.dateRange ? ` Date overlap applied for ${aiPlan.dateRange.start} through ${aiPlan.dateRange.end}.` : ''}{aiPlan.location ? ` Map location verified as ${aiPlan.location.label}.` : ''}</>
              : <><strong>Live catalog, AI-ready.</strong> Describe a hunt in plain language or use the filters. Hunt facts come directly from Hunt Planner API 1.1.</>}</p>
            <small>{aiPlan ? 'OpenAI + IDFG' : 'Source: IDFG'}</small>
          </aside>

          {overlapQuery && <div className="overlap-note" role="status">
            <strong>Cross-species overlap mode</strong>
            <span>Showing hunt areas where different species have overlapping API season dates. Results share an area or GMU and a live date intersection.</span>
          </div>}

          {aiPlan?.proximity && <div className="proximity-note" role="status">
            <strong>{proximityState === 'loading' ? 'Checking nearby hunt geometry…' : `${aiPlan.proximity.radiusMiles}-mile planning buffer`}</strong>
            <span>{aiPlan.proximity.hours} {aiPlan.proximity.hours === 1 ? 'hour' : 'hours'} × {aiPlan.proximity.radiusMiles / aiPlan.proximity.hours} miles. Any overlap between the buffer and the returned hunt-area or GMU polygon qualifies; this is not estimated drive time.</span>
          </div>}

          <div className="opportunity-list">
            {groupedOpportunities.map((group) => groupBy === 'location' ? <AreaResult
              key={group.key}
              group={group}
              selectedHunt={selectedHunt}
              focusHuntArea={focusHuntArea}
              isSaved={isSaved}
              toggleSavedHunt={toggleSavedHunt}
              regionLookup={regionLookup}
            /> : groupBy === 'tag' ? <TagPermissionResult
              key={group.key}
              group={group}
              selectedHunt={selectedHunt}
              focusHuntArea={focusHuntArea}
              isSaved={isSaved}
              toggleSavedHunt={toggleSavedHunt}
            /> : <section className="opportunity-group" key={group.key}>
              {group.label && <OpportunityGroupHeading group={group} mode={groupBy} />}
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
            </section>)}
            {apiState === 'ready' && opportunities.length === 0 && <div className="api-empty"><Search size={24} /><strong>No live hunts matched those filters.</strong><span>{filters.region.length && regionState === 'loading' ? 'Matching GMUs to live regional boundaries…' : 'Try broader species, hunt type, region, or search terms.'}</span></div>}
          </div>
          </>}
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
