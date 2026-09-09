const valueFor = (attributes, fields = []) => {
  for (const field of fields) {
    const value = attributes?.[field];
    if (value !== undefined && value !== null && `${value}`.trim()) return `${value}`.trim();
  }
  return null;
};

const formatValue = (value, format) => {
  if (format === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number) : value;
  }
  if (format === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  return value;
};

export function formatIdentifyFeature(definition, attributes, geometry = null) {
  const identify = definition.identify ?? {};
  const rawTitle = valueFor(attributes, identify.titleFields) ?? definition.label;
  const title = identify.titlePrefix ? `${identify.titlePrefix} ${rawTitle}` : rawTitle;
  const facts = (identify.fields ?? [])
    .map(({ field, label, suffix, format }) => {
      const value = valueFor(attributes, [field]);
      return value ? { label, value: `${formatValue(value, format)}${suffix ?? ''}` } : null;
    })
    .filter(Boolean);

  return {
    id: `${definition.id}-${title}-${facts.map((fact) => fact.value).join('-')}`,
    category: identify.category ?? 'Map context',
    layer: definition.label,
    title,
    note: identify.note,
    facts,
    geometry,
  };
}

const queryTarget = async (target, definition, point) => {
  await target.load();
  const query = {
    geometry: point,
    spatialRelationship: 'intersects',
    outFields: ['*'],
    returnGeometry: true,
    num: definition.identify?.maxResults ?? 2,
  };
  if (definition.identify?.orderByFields) query.orderByFields = definition.identify.orderByFields;
  let result;
  try {
    result = await target.queryFeatures(query);
  } catch (error) {
    if (!query.orderByFields) throw error;
    delete query.orderByFields;
    result = await target.queryFeatures(query);
  }
  return result.features.map((feature) => formatIdentifyFeature(definition, feature.attributes, feature.geometry));
};

export async function identifyVisibleLayers(definitions, layerInstances, point) {
  const tasks = definitions.flatMap((definition) => {
    const layer = layerInstances.get(definition.id);
    if (!layer?.visible || !definition.identify) return [];

    if (typeof layer.queryFeatures === 'function') {
      return [queryTarget(layer, definition, point)];
    }

    if (layer.type === 'map-image') {
      return [(async () => {
        await layer.load();
        const allowedIds = new Set(definition.sublayers ?? []);
        const sublayers = layer.allSublayers?.toArray?.().filter((sublayer) => allowedIds.has(sublayer.id)) ?? [];
        const matches = await Promise.all(sublayers.map((sublayer) => queryTarget(sublayer, definition, point)));
        return matches.flat();
      })()];
    }

    return [];
  });

  const settled = await Promise.allSettled(tasks);
  const unique = new Map();
  settled.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach((match) => unique.set(match.id, match));
  });
  return [...unique.values()];
}
