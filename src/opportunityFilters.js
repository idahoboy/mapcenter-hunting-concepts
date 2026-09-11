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

const overlapKey = (hunt) => hunt.areaId ? `area:${hunt.areaId}` : hunt.unit ? `unit:${hunt.unit}` : null;
const dateInterval = (hunt) => {
  const open = parseApiDate(hunt.open);
  const close = parseApiDate(hunt.close);
  return open && close ? { open, close } : null;
};

export const filterOverlappingOpportunities = (hunts) => {
  const groups = new Map();
  hunts.forEach((hunt) => {
    const key = overlapKey(hunt);
    if (key) groups.set(key, [...(groups.get(key) ?? []), hunt]);
  });
  const qualifyingKeys = new Set();
  groups.forEach((rows, key) => {
    const species = [...new Set(rows.map((row) => row.species).filter(Boolean))];
    if (species.length < 2) return;
    for (let i = 0; i < rows.length; i += 1) {
      const left = dateInterval(rows[i]);
      if (!left) continue;
      for (let j = i + 1; j < rows.length; j += 1) {
        if (rows[i].species === rows[j].species) continue;
        const right = dateInterval(rows[j]);
        if (right && left.open <= right.close && left.close >= right.open) {
          qualifyingKeys.add(key);
          return;
        }
      }
    }
  });
  return hunts.filter((hunt) => qualifyingKeys.has(overlapKey(hunt)));
};

export const filterOpportunities = (hunts, { search = '', filters, regionLookup = new Map(), dateRange = null }) => {
  const query = search.trim().toLowerCase();
  const unitQuery = query.match(/^(?:unit|gmu)\s*(\d{1,2}[a-z]?)$/i)?.[1]?.toUpperCase() ?? null;
  return hunts.filter((hunt) => {
    if (!isActiveBigGame(hunt.species)) return false;
    const matchesQuery = !query || (unitQuery
      ? String(hunt.unit ?? '').toUpperCase() === unitQuery
      : [
      hunt.id,
      hunt.tag,
      hunt.areaLabel,
      hunt.tagArea,
      hunt.species,
      hunt.season,
      hunt.method,
      ].some((value) => includesText(value, query)));
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
