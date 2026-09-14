const areaKey = (hunt) => hunt.areaId
  ? `area:${hunt.areaId}`
  : `unit:${hunt.unit || hunt.areaLabel || 'unspecified'}`;

export const getTagPermissionKey = (hunt) => hunt.opGroupId
  ? `opgroup:${hunt.opGroupId}`
  : `tag:${hunt.tag || 'unspecified'}`;

export const buildTagPermissions = (hunts) => {
  const permissions = new Map();
  hunts.forEach((hunt) => {
    const key = getTagPermissionKey(hunt);
    if (!permissions.has(key)) {
      permissions.set(key, {
        key,
        label: hunt.tag || 'Unnamed tag',
        opGroupId: hunt.opGroupId,
        species: new Set(),
        tagTypes: new Set(),
        areas: new Set(),
        opportunityCount: 0,
      });
    }
    const permission = permissions.get(key);
    if (hunt.species) permission.species.add(hunt.species);
    if (hunt.kind) permission.tagTypes.add(hunt.kind);
    permission.areas.add(areaKey(hunt));
    permission.opportunityCount += 1;
  });
  return [...permissions.values()]
    .map((permission) => ({
      ...permission,
      species: [...permission.species].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
      tagTypes: [...permission.tagTypes].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
      areaCount: permission.areas.size,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
};

export const matchesTagPermission = (hunt, permissionKey) => getTagPermissionKey(hunt) === permissionKey;
