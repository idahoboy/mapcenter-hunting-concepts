import { describe, expect, it } from 'vitest';
import { filterOpportunities } from './opportunityFilters.js';

const hunts = [
  { id: '1', tag: 'A', areaLabel: 'Unit 12', tagArea: '', species: 'Elk', season: 'General Archery', method: 'Archery', kind: 'General season', unit: '12' },
  { id: '2', tag: 'B', areaLabel: '45', tagArea: '', species: 'Mule and White-tailed Deer', season: 'Controlled Hunt Any Weapon', method: 'Any Weapon', kind: 'Controlled hunt', unit: '45' },
  { id: '3', tag: 'C', areaLabel: 'Unit 15', tagArea: '', species: 'White-tailed Deer', season: 'General Archery', method: 'Archery', kind: 'General season', unit: '15' },
  { id: '4', tag: 'D', areaLabel: 'Unit 10', tagArea: '', species: 'Elk', season: 'General A Tag', method: 'Archery', kind: 'General season', unit: '10' },
  { id: '5', tag: 'E', areaLabel: 'Unit 8', tagArea: '', species: 'White-tailed Deer', season: 'General Archery', method: 'Archery', kind: 'General season', unit: '8', open: '8/30/26', close: '9/30/26', dates: 'Aug 30, 2026–Sep 30, 2026' },
  { id: '6', tag: 'F', areaLabel: 'Unit 9', tagArea: '', species: 'White-tailed Deer', season: 'General Archery', method: 'Archery', kind: 'General season', unit: '9', open: '11/15/26', close: '12/15/26', dates: 'Nov 15, 2026–Dec 15, 2026' },
];

const emptyFilters = { species: [], season: [], huntType: [], region: [] };

describe('opportunity multi-select filters', () => {
  it('matches any selected value within a filter and all active filter groups', () => {
    const rows = filterOpportunities(hunts, {
      filters: { ...emptyFilters, species: ['Elk', 'Deer'], huntType: ['General season'] },
    });
    expect(rows.map((hunt) => hunt.id)).toEqual(['1', '3', '4', '5', '6']);
  });

  it('filters inferred GMUs using the live GIS-derived region lookup', () => {
    const regionLookup = new Map([
      ['12', ['Clearwater Region']],
      ['45', ['Southwest Region']],
      ['15', ['Clearwater Region']],
    ]);
    const rows = filterOpportunities(hunts, {
      filters: { ...emptyFilters, region: ['Clearwater Region'] },
      regionLookup,
    });
    expect(rows.map((hunt) => hunt.id)).toEqual(['1', '3']);
  });

  it('matches weapon filters against the API legal method field', () => {
    const rows = filterOpportunities(hunts, {
      filters: { ...emptyFilters, season: ['Archery'] },
    });
    expect(rows.map((hunt) => hunt.id)).toContain('4');
  });

  it('matches only records whose API season interval overlaps the requested dates', () => {
    const rows = filterOpportunities(hunts, {
      filters: { ...emptyFilters, species: ['Deer'] },
      dateRange: { start: '2026-12-01', end: '2026-12-31' },
    });
    expect(rows.map((hunt) => hunt.id)).toEqual(['6']);
  });
});
