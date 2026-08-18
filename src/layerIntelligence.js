const SYNONYMS = {
  elk: ['elk', 'zone', 'species'],
  deer: ['deer', 'species', 'unit'],
  access: ['access', 'public', 'land', 'property'],
  public: ['public', 'access', 'land', 'ownership'],
  controlled: ['controlled', 'draw', 'permit', 'opportunity'],
  road: ['road', 'motor', 'motorized', 'vehicle'],
  motor: ['motor', 'motorized', 'vehicle', 'restriction'],
  camp: ['camp', 'camping', 'campground', 'overnight'],
  closure: ['closure', 'restriction'],
};

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function deriveLayerStack(layers, query, filters) {
  const rawTerms = normalize(`${query} ${Object.values(filters).join(' ')}`).split(/\s+/).filter(Boolean);
  const terms = new Set(rawTerms.flatMap((term) => [term, ...(SYNONYMS[term] ?? [])]));

  return layers
    .map((layer) => {
      const matches = (layer.signals ?? []).filter((signal) => terms.has(normalize(signal)));
      const foundationBoost = layer.id === 'game-units' ? 1.5 : 0;
      const score = matches.length * 2 + foundationBoost;
      return {
        ...layer,
        score,
        matches,
        reason: matches.length
          ? `Matched ${matches.slice(0, 3).join(', ')}`
          : layer.id === 'game-units'
            ? 'Provides the comparison geography'
            : 'Available as a manual layer',
      };
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
