import { describe, expect, it } from 'vitest';
import { inferUnit, normalizeHunt } from './huntPlannerApi.js';

const liveShape = { season: 'Controlled Hunt Either Sex', tagid: 33609, tag: 'Elk Controlled Hunt 2111', tagarea: '30A-1', ornament: 'Antlerless or Antlered', open: '8/1/26', close: '8/29/26', number: '2111', permits: 10, game: 'Elk', method: 'Any Weapon', area: '30A-1', areaid: 2830, id: 82313 };

describe('Hunt Planner API adapter', () => {
  it('normalizes the documented API row without inventing planning facts', () => {
    expect(normalizeHunt(liveShape)).toMatchObject({
      id: '82313', areaId: 2830, unit: '30A', dates: 'Aug 1, 2026–Aug 29, 2026', tagAvailability: '10 permits',
      map: { kind: 'hunt-area', where: 'ID = 2830', label: 'Hunt Area 30A-1' },
    });
  });

  it('extracts a GMU from general-season area text', () => {
    expect(inferUnit({ area: 'Unit 13', tagarea: 'Black Bear Tag' })).toBe('13');
  });

  it('distinguishes GMU subunits from extra-hunt area suffixes', () => {
    expect(inferUnit({ area: '36B', tagarea: '' })).toBe('36B');
    expect(inferUnit({ area: '41X', tagarea: '' })).toBe('41');
  });

  it('falls back to GMU context only when areaid is unavailable', () => {
    expect(normalizeHunt({ ...liveShape, areaid: null }).map).toMatchObject({
      kind: 'gmu', where: "NAME = '30A'", label: 'GMU 30A',
    });
  });
});
