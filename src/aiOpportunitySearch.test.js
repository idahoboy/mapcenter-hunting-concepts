import { describe, expect, it } from 'vitest';
import { createFallbackOpportunityPlan, inferDateRange, normalizeOpportunityPlan, resolveCatalogSearch } from './aiOpportunitySearch.js';

const filterOptions = {
  species: { options: ['Elk', 'Deer'] },
  season: { options: ['Archery'] },
  huntType: { options: ['General season'] },
  region: { options: ['Clearwater Region'] },
};
const layers = [{ id: 'game-units' }, { id: 'access-yes' }];

describe('AI opportunity search plans', () => {
  it('accepts only UI filters and configured GIS layer ids', () => {
    const plan = normalizeOpportunityPlan({
      summary: 'Elk access in Clearwater.',
      search: 'Unit 12',
      filters: {
        species: ['Elk', 'Turkey'],
        season: ['Archery'],
        huntType: ['General season'],
        region: ['Clearwater Region', 'Somewhere else'],
      },
      layerIds: ['game-units', 'access-yes', 'invented-layer'],
      focusUnit: '12',
      location: {
        query: 'Genesee', label: 'Genesee, ID, USA', longitude: -116.928251,
        latitude: 46.549543, state: 'ID', addressType: 'Locality', score: 100,
        stateExplicit: false, source: 'ArcGIS World Geocoding Service',
      },
    }, { filterOptions, layers });

    expect(plan.filters.species).toEqual(['Elk']);
    expect(plan.filters.region).toEqual(['Clearwater Region']);
    expect(plan.layerIds).toEqual(['game-units', 'access-yes']);
    expect(plan.focusUnit).toBe('12');
    expect(plan.location).toMatchObject({ label: 'Genesee, ID, USA', state: 'ID', stateExplicit: false });
  });

  it('keeps live service search useful when AI is unavailable', () => {
    const plan = createFallbackOpportunityPlan({
      query: 'archery elk in Clearwater with public access',
      currentFilters: { species: [], season: [], huntType: [], region: [] },
      filterOptions,
      layers,
    });

    expect(plan.search).toBe('');
    expect(plan.filters.species).toEqual(['Elk']);
    expect(plan.filters.season).toEqual(['Archery']);
    expect(plan.filters.region).toEqual(['Clearwater Region']);
    expect(plan.layerIds).toEqual(['game-units', 'access-yes']);
  });

  it('infers an inclusive month range when the AI service is unavailable', () => {
    expect(inferDateRange('white-tailed deer options for December, 2026')).toEqual({
      start: '2026-12-01', end: '2026-12-31',
    });
  });

  it('infers the next upcoming year for a month without an explicit year', () => {
    expect(inferDateRange('white-tailed deer hunting in november', new Date('2026-09-10T12:00:00Z'))).toEqual({
      start: '2026-11-01', end: '2026-11-30',
    });
  });

  it('drops an AI keyword that cannot occur in the authoritative catalog', () => {
    const catalog = [{ tag: 'Elk A Tag', areaLabel: 'Units 10 and 12', method: 'Archery' }];
    expect(resolveCatalogSearch('archery elk in Clearwater', catalog)).toBe('');
    expect(resolveCatalogSearch('Units 10', catalog)).toBe('Units 10');
  });

  it('resolves GMU searches against an exact unit value', () => {
    expect(resolveCatalogSearch('Unit 1', [{ unit: '10' }, { unit: '1' }])).toBe('Unit 1');
    expect(resolveCatalogSearch('Unit 1', [{ unit: '10' }])).toBe('');
  });
});
