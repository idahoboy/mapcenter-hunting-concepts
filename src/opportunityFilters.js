const includesText = (value, query) => String(value ?? '').toLowerCase().includes(query);

const isActiveBigGame = (species) => !['Mountain Lion', 'Turkey'].includes(species);

const matchesSpeciesOption = (species, option) => {
  if (option === 'Deer') return includesText(species, 'deer');
  if (option === 'Pronghorn') return includesText(species, 'pronghorn');
  return species === option;
};

export const filterOpportunities = (hunts, { search = '', filters, regionLookup = new Map() }) => {
  const query = search.trim().toLowerCase();
  return hunts.filter((hunt) => {
    if (!isActiveBigGame(hunt.species)) return false;
    const matchesQuery = !query || [
      hunt.id,
      hunt.tag,
      hunt.areaLabel,
      hunt.tagArea,
      hunt.species,
      hunt.season,
      hunt.method,
    ].some((value) => includesText(value, query));
    const matchesSpecies = !filters.species.length || filters.species.some((option) => matchesSpeciesOption(hunt.species, option));
    const matchesHuntType = !filters.huntType.length || filters.huntType.includes(hunt.kind);
    const matchesSeason = !filters.season.length || filters.season.some((season) => includesText(hunt.season, season));
    const huntRegions = hunt.unit ? regionLookup.get(hunt.unit) ?? [] : [];
    const matchesRegion = !filters.region.length || filters.region.some((region) => huntRegions.includes(region));
    return matchesQuery && matchesSpecies && matchesHuntType && matchesSeason && matchesRegion;
  });
};
