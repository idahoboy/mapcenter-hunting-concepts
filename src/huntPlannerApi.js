import config from './config.js';

export const GAME_IDS = {
  Deer: '1', Elk: '2', Pronghorn: '3', 'Black Bear': '4', Moose: '6', Turkey: '27',
};

const api = config.dataProviders.huntPlanner;
const apiBase = api.baseUrl.replace(/\/$/, '');
const currentRange = api.seasonWindow;
let fullCatalogPromise;

const formatDate = (value) => {
  const [month, day, year] = String(value).split('/').map(Number);
  if (!month || !day || !year) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(2000 + year, month - 1, day));
};

export const inferUnit = (row) => {
  const source = `${row.area ?? ''} ${row.tagarea ?? ''}`;
  const explicit = source.match(/\bUnits?\s+(\d{1,2}[A]?)\b/i);
  if (explicit) return explicit[1].toUpperCase();
  const areaCode = String(row.area ?? '').match(/^(\d{1,2}[A]?)(?:-|$)/i);
  return areaCode?.[1]?.toUpperCase() ?? null;
};

export const normalizeHunt = (row) => {
  const controlled = String(row.season).toLowerCase().startsWith('controlled');
  const unit = inferUnit(row);
  return {
    id: String(row.id),
    kind: controlled ? 'Controlled hunt' : 'General season',
    species: row.game,
    season: row.season,
    areaLabel: row.area,
    tagArea: row.tagarea,
    unit,
    tag: row.tag,
    tagId: row.tagid,
    huntNumber: row.number,
    permits: Number(row.permits),
    tagAvailability: Number(row.permits) >= 99999 ? 'Unlimited tags' : `${Number(row.permits).toLocaleString()} permits`,
    dates: `${formatDate(row.open)}–${formatDate(row.close)}`,
    open: row.open,
    close: row.close,
    sex: row.ornament,
    method: row.method,
    status: controlled ? 'Controlled hunt application' : 'General-season tag',
    sourceUrl: `https://idfg.idaho.gov/ifwis/huntplanner/hunt/${row.id}`,
    apiVersion: api.version,
    map: unit ? {
      url: 'https://services.arcgis.com/FjJI5xHF2dUPVrgK/ArcGIS/rest/services/GameManagementUnits/FeatureServer/0',
      where: `NAME = '${unit.replaceAll("'", "''")}'`,
    } : null,
  };
};

const request = async (parameters) => {
  const search = new URLSearchParams({ ...currentRange, ...parameters });
  Object.entries(Object.fromEntries(search)).forEach(([key, value]) => {
    if (value === '' || value === 'undefined' || value === 'null') search.delete(key);
  });
  const response = await fetch(`${apiBase}/list/?${search}`);
  if (!response.ok) throw new Error(`Hunt Planner API returned ${response.status}`);
  const payload = await response.json();
  if (payload.response !== 'success') throw new Error(payload.msg || 'Hunt Planner API request failed');
  return { ...payload, rows: payload.rows.map(normalizeHunt) };
};

export const fetchHunts = ({ search = '', species = '', huntType = '', limit = api.pageSize, offset = 0 } = {}) => request({
  search,
  game: GAME_IDS[species] ?? '',
  type: huntType === 'General season' ? '1' : huntType === 'Controlled hunt' ? '2' : '',
  limit,
  offset,
  sort: 'open',
  order: 'asc',
});

export const fetchCatalog = () => {
  fullCatalogPromise ??= request({ limit: api.catalogLimit, sort: 'open', order: 'asc' }).then((result) => result.rows);
  return fullCatalogPromise;
};

export const fetchHunt = async (huntId) => {
  const catalog = await fetchCatalog();
  return catalog.find((hunt) => hunt.id === String(huntId)) ?? null;
};

export const providerInfo = config.dataProviders;
