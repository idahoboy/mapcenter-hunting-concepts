import { describe, expect, it } from 'vitest';
import { buildTagPermissions, getTagPermissionSpeciesFamilies, matchesTagPermission, matchesTagPermissionSpecies } from './tagPermissions.js';

const hunts = [
  { id: '1', tag: 'Regular Deer Tag', opGroupId: 20, species: 'Mule Deer', kind: 'General season', areaId: 101 },
  { id: '2', tag: 'Regular Deer Tag', opGroupId: 20, species: 'White-tailed Deer', kind: 'General season', areaId: 102 },
  { id: '3', tag: 'Elk Controlled Hunt 2001', opGroupId: 30, species: 'Elk', kind: 'Controlled hunt', unit: '10' },
];

describe('tag permissions', () => {
  it('turns opgroups into permission packages with opportunity and area totals', () => {
    const permission = buildTagPermissions(hunts).find((item) => item.key === 'opgroup:20');
    expect(permission).toMatchObject({
      label: 'Regular Deer Tag',
      opportunityCount: 2,
      areaCount: 2,
      species: ['Mule Deer', 'White-tailed Deer'],
      tagTypes: ['General season'],
    });
  });

  it('matches an opportunity to its selected permission package', () => {
    expect(matchesTagPermission(hunts[2], 'opgroup:30')).toBe(true);
    expect(matchesTagPermission(hunts[2], 'opgroup:20')).toBe(false);
  });

  it('matches hunter-friendly species families to specific API species', () => {
    const permissions = buildTagPermissions(hunts);
    const permission = permissions.find((item) => item.key === 'opgroup:20');
    expect(matchesTagPermissionSpecies(permission, 'Deer')).toBe(true);
    expect(matchesTagPermissionSpecies(permission, 'Elk')).toBe(false);
    expect(matchesTagPermissionSpecies(permission, 'all')).toBe(true);
    expect(getTagPermissionSpeciesFamilies(permissions)).toEqual(['Deer', 'Elk']);
  });
});
