import { describe, expect, it } from 'vitest';
import { buildUnitWhereClause, getHuntMapUnits } from './huntMapSelection.js';

describe('hunt result map selection', () => {
  it('collects every GMU named by a multi-unit opportunity', () => {
    expect(getHuntMapUnits({
      unit: '8',
      areaLabel: 'Units 8, 8A and 11A',
      tagArea: 'Palouse Zone',
    })).toEqual(['8', '8A', '11A']);
  });

  it('builds one safe query for the selected boundaries', () => {
    expect(buildUnitWhereClause(['8', '8A', '11A']))
      .toBe("NAME IN ('8', '8A', '11A')");
  });

  it('does not treat a hunt-area suffix as another GMU', () => {
    expect(getHuntMapUnits({ unit: '51', areaLabel: '51-1X' })).toEqual(['51']);
  });
});
