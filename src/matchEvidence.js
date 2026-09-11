const includes = (value, term) => String(value ?? '').toLowerCase().includes(String(term ?? '').toLowerCase());

export function buildMatchEvidence(hunt, plan, regionLookup, layers) {
  if (!plan) return { criteria: [], contextLayers: [] };
  const criteria = [];
  const selectedSpecies = plan.filters.species.filter((option) =>
    option === 'Deer' ? includes(hunt.species, 'deer') : hunt.species === option);
  if (selectedSpecies.length) {
    criteria.push({ id: 'species', label: 'Species', value: hunt.species, source: 'Hunt Planner API 1.1' });
  }

  const selectedMethods = plan.filters.season.filter((option) =>
    includes(hunt.method, option) || includes(hunt.season, option));
  if (selectedMethods.length) {
    criteria.push({ id: 'method', label: 'Legal method', value: hunt.method, source: 'Hunt Planner API 1.1' });
  }

  if (plan.filters.huntType.includes(hunt.kind)) {
    criteria.push({ id: 'hunt-type', label: 'Hunt type', value: hunt.kind, source: 'Hunt Planner API 1.1' });
  }

  const huntRegions = hunt.unit ? regionLookup.get(hunt.unit) ?? [] : [];
  const selectedRegions = huntRegions.filter((region) => plan.filters.region.includes(region));
  if (selectedRegions.length) {
    criteria.push({
      id: 'region',
      label: 'Region',
      value: selectedRegions.join(', '),
      source: `GMU ${hunt.unit} boundary`,
    });
  }

  if (plan.search) {
    const values = [hunt.id, hunt.tag, hunt.areaLabel, hunt.tagArea, hunt.species, hunt.season, hunt.method];
    if (values.some((value) => includes(value, plan.search))) {
      criteria.push({ id: 'keyword', label: 'Catalog term', value: plan.search, source: 'Hunt Planner API 1.1' });
    }
  }

  const selectedLayerIds = new Set(plan.layerIds);
  const contextLayers = layers
    .filter((layer) => selectedLayerIds.has(layer.id) && layer.id !== 'game-units')
    .map((layer) => ({ id: layer.id, label: layer.label }));

  return { criteria, contextLayers };
}
