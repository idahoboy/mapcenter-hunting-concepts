import config from './config.js';

const endpoint = config.dataProviders.opportunitySearch.baseUrl;

const keepAllowed = (values, allowed) => {
  const allowedValues = new Set(allowed);
  return Array.isArray(values) ? values.filter((value) => allowedValues.has(value)) : [];
};

const monthNumbers = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
  ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

const normalizeDateRange = (dateRange) => {
  const start = String(dateRange?.start ?? '');
  const end = String(dateRange?.end ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return null;
  return { start, end };
};

export const inferDateRange = (query, now = new Date()) => {
  const match = String(query ?? '').toLowerCase().match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*,?\s*(20\d{2}))?\b/,
  );
  if (!match) return null;
  const month = monthNumbers.get(match[1]);
  const requestedYear = match[2] ? Number(match[2]) : now.getFullYear();
  const year = !match[2] && month < now.getMonth() + 1 ? requestedYear + 1 : requestedYear;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, '0');
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
};

const normalizeLocation = (location) => {
  const longitude = Number(location?.longitude);
  const latitude = Number(location?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return {
    query: String(location.query ?? '').trim(),
    label: String(location.label ?? location.query ?? 'Resolved place').trim(),
    longitude,
    latitude,
    state: String(location.state ?? '').trim(),
    addressType: String(location.addressType ?? '').trim(),
    score: Number(location.score) || 0,
    stateExplicit: location.stateExplicit === true,
    source: location.source === 'ArcGIS World Geocoding Service'
      ? location.source
      : 'Verified geocoder',
  };
};

export const normalizeOpportunityPlan = (plan, { filterOptions, layers }) => {
  const layerIds = new Set(layers.map((layer) => layer.id));
  return {
    summary: typeof plan?.summary === 'string' && plan.summary.trim()
      ? plan.summary.trim()
      : 'Search interpreted against live IDFG services.',
    search: typeof plan?.search === 'string' ? plan.search.trim() : '',
    filters: Object.fromEntries(
      Object.entries(filterOptions).map(([key, definition]) => [
        key,
        keepAllowed(plan?.filters?.[key], definition.options),
      ]),
    ),
    layerIds: Array.isArray(plan?.layerIds)
      ? [...new Set(plan.layerIds.filter((id) => layerIds.has(id)))]
      : [],
    focusUnit: typeof plan?.focusUnit === 'string' && /^[0-9]{1,2}[A-Z]?$/.test(plan.focusUnit)
      ? plan.focusUnit
      : null,
    dateRange: normalizeDateRange(plan?.dateRange),
    location: normalizeLocation(plan?.location),
  };
};

export const resolveCatalogSearch = (search, catalog) => {
  const term = String(search ?? '').trim().toLowerCase();
  if (!term) return '';
  const fields = ['id', 'tag', 'areaLabel', 'tagArea', 'species', 'season', 'method'];
  return catalog.some((hunt) => fields.some((field) =>
    String(hunt[field] ?? '').toLowerCase().includes(term))) ? search.trim() : '';
};

export const createFallbackOpportunityPlan = ({ query, currentFilters, filterOptions, layers }) => {
  const normalized = query.toLowerCase();
  const filters = Object.fromEntries(Object.entries(filterOptions).map(([key, definition]) => {
    const matches = definition.options.filter((option) => {
      const label = option.toLowerCase();
      const shortLabel = label.replace(/ region$/, '');
      if (key === 'huntType' && option === 'Controlled hunt') return /\b(controlled|draw|permit)\b/.test(normalized);
      if (key === 'huntType' && option === 'General season') return /\bgeneral\b/.test(normalized);
      return normalized.includes(label) || (shortLabel.length > 3 && normalized.includes(shortLabel));
    });
    return [key, matches.length ? matches : currentFilters[key] ?? []];
  }));
  const unit = query.match(/\b(?:unit|gmu)\s*([0-9]{1,2}[a-z]?)\b/i)?.[1]?.toUpperCase() ?? null;
  const selected = new Set(['game-units']);
  if (filters.region.length) selected.add('regions');
  if (/\b(access|public land|private land|walk-in)\b/i.test(query)) {
    selected.add('access-yes');
    selected.add('surface-management');
  }
  if (/\b(controlled|draw|permit)\b/i.test(query)) selected.add('controlled-hunts');
  if (/\belk\b/i.test(query)) selected.add('elk-zones');
  if (/\b(motor|vehicle|road)\b/i.test(query)) selected.add('motorized-rules');
  if (/\b(camp|camping|campground)\b/i.test(query)) selected.add('campgrounds');
  const allowedLayers = new Set(layers.map((layer) => layer.id));

  return normalizeOpportunityPlan({
    summary: 'AI is unavailable; recognizable terms were applied to the same live services.',
    search: unit ?? (/^[\w-]{1,12}$/.test(query.trim()) ? query.trim() : ''),
    filters,
    layerIds: [...selected].filter((id) => allowedLayers.has(id)),
    focusUnit: unit,
    dateRange: inferDateRange(query),
    location: null,
  }, { filterOptions, layers });
};

export async function interpretOpportunitySearch({ query, currentFilters, filterOptions, layers }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      context: {
        currentFilters,
        filterOptions: Object.fromEntries(
          Object.entries(filterOptions).map(([key, definition]) => [key, definition.options]),
        ),
        layers: layers.map(({ id, label, description, signals }) => ({ id, label, description, signals })),
        sources: ['Hunt Planner API 1.1', 'IDFG ArcGIS services'],
      },
    }),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.message || `AI search returned ${response.status}`);
  }

  const plan = normalizeOpportunityPlan(await response.json(), { filterOptions, layers });
  return plan.dateRange ? plan : { ...plan, dateRange: inferDateRange(query) };
}
