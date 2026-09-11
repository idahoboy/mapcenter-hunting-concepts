const UNIT_PATTERN = /\b\d{1,2}[A-Z]?\b/gi;

export function getHuntMapUnits(hunt) {
  const units = hunt.unit ? [String(hunt.unit).toUpperCase()] : [];
  const areaLabel = String(hunt.areaLabel ?? '').trim();
  const labelUnits = /^units?\b/i.test(areaLabel)
    ? areaLabel.match(UNIT_PATTERN) ?? []
    : (!hunt.unit && /^\d{1,2}[A-Z]?$/i.test(areaLabel) ? [areaLabel] : []);

  return [...new Set(
    [...units, ...labelUnits].map((unit) => unit.toUpperCase()),
  )];
}

export function buildUnitWhereClause(units) {
  const quotedUnits = units.map((unit) => `'${unit.replaceAll("'", "''")}'`);
  return quotedUnits.length ? `NAME IN (${quotedUnits.join(', ')})` : '1 = 0';
}

export function getCombinedExtent(features) {
  const extents = features.map((feature) => feature.geometry?.extent).filter(Boolean);
  if (!extents.length) return null;
  return extents.slice(1).reduce((combined, extent) => combined.union(extent), extents[0].clone());
}
