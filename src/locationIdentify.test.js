import { describe, expect, it } from 'vitest';
import { formatIdentifyFeature } from './locationIdentify.js';

describe('map location summaries', () => {
  it('formats configured boundary fields without exposing raw attributes', () => {
    const result = formatIdentifyFeature({
      id: 'surface-management',
      label: 'State & federal land management',
      identify: {
        category: 'Land & access',
        titleFields: ['AGNCY_NAME'],
        fields: [{ field: 'GIS_ACRES', label: 'Polygon acres', format: 'number' }],
      },
    }, { AGNCY_NAME: 'U.S. Forest Service', GIS_ACRES: 609504.177, OBJECTID: 42 });

    expect(result.title).toBe('U.S. Forest Service');
    expect(result.facts).toEqual([{ label: 'Polygon acres', value: '609,504' }]);
    expect(result.facts.some((fact) => fact.label === 'OBJECTID')).toBe(false);
  });

  it('adds a configured prefix to recognizable hunt geography', () => {
    const result = formatIdentifyFeature({
      id: 'game-units',
      label: 'Game management units',
      identify: { category: 'Hunts & boundaries', titlePrefix: 'GMU', titleFields: ['NAME'] },
    }, { NAME: '51' });

    expect(result.title).toBe('GMU 51');
  });
});
