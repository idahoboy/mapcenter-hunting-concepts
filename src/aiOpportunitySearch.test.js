import { describe, expect, it } from 'vitest';
import { createFallbackOpportunityPlan, normalizeOpportunityPlan, resolveCatalogSearch } from './aiOpportunitySearch.js';

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
    }, { filterOptions, layers });

    expect(plan.filters.species).toEqual(['Elk']);
    expect(plan.filters.region).toEqual(['Clearwater Region']);
    expect(plan.layerIds).toEqual(['game-units', 'access-yes']);
    expect(plan.focusUnit).toBe('12');
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

  it('drops an AI keyword that cannot occur in the authoritative catalog', () => {
    const catalog = [{ tag: 'Elk A Tag', areaLabel: 'Units 10 and 12', method: 'Archery' }];
    expect(resolveCatalogSearch('archery elk in Clearwater', catalog)).toBe('');
    expect(resolveCatalogSearch('Units 10', catalog)).toBe('Units 10');
  });
});
