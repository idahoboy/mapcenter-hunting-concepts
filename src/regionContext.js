import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import { accelerateGeometry, execute as contains } from '@arcgis/core/geometry/operators/containsOperator.js';
import config from './config.js';

export const REGION_NAMES = [
  'Panhandle Region',
  'Clearwater Region',
  'Southwest Region',
  'Magic Valley Region',
  'Southeast Region',
  'Upper Snake Region',
  'Salmon Region',
];

let lookupPromise;

export const buildRegionLookup = (units, regions) => {
  regions.forEach((region) => accelerateGeometry(region.geometry));
  return new Map(units.map((unit) => [
    String(unit.attributes.NAME).toUpperCase(),
    regions
      .filter((region) => contains(region.geometry, unit.geometry.centroid))
      .map((region) => region.attributes.NAME),
  ]));
};

export const fetchRegionLookup = () => {
  lookupPromise ??= (async () => {
    const regionDefinition = config.layerGroups
      .flatMap((group) => group.layers)
      .find((layer) => layer.id === 'regions');
    const unitsLayer = new FeatureLayer({
      url: 'https://services.arcgis.com/FjJI5xHF2dUPVrgK/ArcGIS/rest/services/GameManagementUnits/FeatureServer/0',
    });
    const regionsLayer = new FeatureLayer({ url: regionDefinition.url });
    await Promise.all([unitsLayer.load(), regionsLayer.load()]);
    const [units, regions] = await Promise.all([
      unitsLayer.queryFeatures({ where: '1=1', outFields: ['NAME'], returnGeometry: true }),
      regionsLayer.queryFeatures({ where: '1=1', outFields: ['NAME'], returnGeometry: true }),
    ]);
    return buildRegionLookup(units.features, regions.features);
  })();
  return lookupPromise;
};
