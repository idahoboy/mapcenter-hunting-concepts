import { describe, expect, it } from 'vitest';
import { buildMatchEvidence } from './matchEvidence.js';

describe('authoritative match evidence', () => {
  it('separates verified result criteria from enabled map context', () => {
    const hunt = {
      id: '80909', species: 'Elk', method: 'Archery', season: 'General A Tag',
      kind: 'General season', unit: '10', tag: 'Elk A Tag - Lolo Zone', areaLabel: 'Units 10 and 12',
    };
    const plan = {
      search: '',
      filters: { species: ['Elk'], season: ['Archery'], huntType: [], region: ['Clearwater Region'] },
      layerIds: ['game-units', 'elk-zones', 'access-yes', 'surface-management', 'regions'],
    };
    const evidence = buildMatchEvidence(
      hunt,
      plan,
      new Map([['10', ['Clearwater Region']]]),
      [
        { id: 'game-units', label: 'Game management units' },
        { id: 'access-yes', label: 'Access Yes! properties' },
        { id: 'surface-management', label: 'State & federal land management' },
      ],
    );

    expect(evidence.criteria.map((item) => item.label)).toEqual(['Species', 'Legal method', 'Region']);
    expect(evidence.criteria[2].source).toBe('GMU 10 boundary');
    expect(evidence.contextLayers.map((item) => item.label)).toEqual([
      'Access Yes! properties', 'State & federal land management',
    ]);
  });
});
