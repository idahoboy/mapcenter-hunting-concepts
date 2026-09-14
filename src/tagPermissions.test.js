import { describe, expect, it } from 'vitest';
import { buildTagPermissions, matchesTagPermission } from './tagPermissions.js';

const hunts = [
  { id: '1', tag: 'Regular Deer Tag', opGroupId: 20, species: 'Mule Deer', areaId: 101 },
  { id: '2', tag: 'Regular Deer Tag', opGroupId: 20, species: 'White-tailed Deer', areaId: 102 },
  { id: '3', tag: 'Elk A Tag', opGroupId: 30, species: 'Elk', unit: '10' },
];

describe('tag permissions', () => {
  it('turns opgroups into permission packages with opportunity and area totals', () => {
    const permission = buildTagPermissions(hunts).find((item) => item.key === 'opgroup:20');
    expect(permission).toMatchObject({
      label: 'Regular Deer Tag',
      opportunityCount: 2,
      areaCount: 2,
      species: ['Mule Deer', 'White-tailed Deer'],
    });
  });

  it('matches an opportunity to its selected permission package', () => {
    expect(matchesTagPermission(hunts[2], 'opgroup:30')).toBe(true);
    expect(matchesTagPermission(hunts[2], 'opgroup:20')).toBe(false);
  });
});
