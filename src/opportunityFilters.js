const includesText = (value, query) => String(value ?? '').toLowerCase().includes(String(query ?? '').toLowerCase());

const isActiveBigGame = (species) => !['Mountain Lion', 'Turkey'].includes(species);

const matchesSpeciesOption = (species, option) => {
  if (option === 'Deer') return includesText(species, 'deer');
  if (option === 'Pronghorn') return includesText(species, 'pronghorn');
  return species === option;
};

const parseApiDate = (value) => {
  const [month, day, year] = String(value ?? '').split('/').map(Number);
  if (!month || !day || !year) return null;
  return `${String(2000 + year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const matchesDateRange = (hunt, dateRange) => {
  if (!dateRange?.start || !dateRange?.end) return true;
  const open = parseApiDate(hunt.open);
  const close = parseApiDate(hunt.close);
  if (!open || !close) return false;
  return open <= dateRange.end && close >= dateRange.start;
};

export const filterOpportunities = (hunts, { search = '', filters, regionLookup = new Map(), dateRange = null }) => {
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
    const matchesSeason = !filters.season.length || filters.season.some((season) =>
      includesText(hunt.season, season) || includesText(hunt.method, season));
    const huntRegions = hunt.unit ? regionLookup.get(hunt.unit) ?? [] : [];
    const matchesRegion = !filters.region.length || filters.region.some((region) => huntRegions.includes(region));
    const matchesSex = !filters.sex?.length || filters.sex.includes(hunt.sex);
    const matchesDate = matchesDateRange(hunt, dateRange);
    return matchesQuery && matchesSpecies && matchesHuntType && matchesSeason && matchesRegion && matchesSex && matchesDate;
  });
};
