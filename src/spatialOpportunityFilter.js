import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import Point from '@arcgis/core/geometry/Point.js';
import * as geodesicBufferOperator from '@arcgis/core/geometry/operators/geodesicBufferOperator.js';
import * as intersectsOperator from '@arcgis/core/geometry/operators/intersectsOperator.js';

const chunk = (values, size = 75) => Array.from(
  { length: Math.ceil(values.length / size) },
  (_, index) => values.slice(index * size, (index + 1) * size),
);

export async function createProximityBuffer(location, radiusMiles) {
  if (!geodesicBufferOperator.isLoaded()) await geodesicBufferOperator.load();
  const point = new Point({
    longitude: location.longitude,
    latitude: location.latitude,
    spatialReference: { wkid: 4326 },
  });
  return geodesicBufferOperator.execute(point, radiusMiles, { unit: 'miles' });
}

const queryIntersectingValues = async ({ url, field, values, buffer }) => {
  if (!url || !values.length) return new Set();
  const layer = new FeatureLayer({ url, outFields: [field], popupEnabled: false });
  await layer.load();
  const matches = new Set();
  for (const valueChunk of chunk(values)) {
    const numeric = field === 'ID';
    const literals = valueChunk.map((value) => numeric ? Number(value) : `'${String(value).replaceAll("'", "''")}'`);
    const response = await layer.queryFeatures({
      where: `${field} IN (${literals.join(',')})`,
      outFields: [field],
      returnGeometry: true,
      outSpatialReference: buffer.spatialReference,
    });
    response.features.forEach((feature) => {
      if (feature.geometry && intersectsOperator.execute(buffer, feature.geometry)) {
        matches.add(String(feature.attributes[field]));
      }
    });
  }
  return matches;
};

export async function findIntersectingOpportunityIds(hunts, buffer) {
  const areaRows = hunts.filter((hunt) => hunt.areaId && hunt.map?.kind === 'hunt-area');
  const unitRows = hunts.filter((hunt) => !hunt.areaId && hunt.unit && hunt.map?.kind === 'gmu');
  const areaMatches = await queryIntersectingValues({
    url: areaRows[0]?.map.url,
    field: 'ID',
    values: [...new Set(areaRows.map((hunt) => hunt.areaId))],
    buffer,
  });
  const unitMatches = await queryIntersectingValues({
    url: unitRows[0]?.map.url,
    field: 'NAME',
    values: [...new Set(unitRows.map((hunt) => hunt.unit))],
    buffer,
  });
  return new Set(hunts.filter((hunt) =>
    (hunt.areaId && areaMatches.has(String(hunt.areaId)))
    || (!hunt.areaId && hunt.unit && unitMatches.has(String(hunt.unit)))).map((hunt) => hunt.id));
}
