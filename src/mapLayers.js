import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js';
import TileLayer from '@arcgis/core/layers/TileLayer.js';

const popupTemplate = (title) => ({
  title,
  content: [{ type: 'fields', fieldInfos: [] }],
});

export function createLayer(definition) {
  const common = {
    id: definition.id,
    title: definition.label,
    url: definition.url,
    visible: definition.defaultVisible,
    opacity: definition.opacity ?? 0.8,
  };

  if (definition.type === 'map-image') {
    return new MapImageLayer({
      ...common,
      sublayers: definition.sublayers?.map((id) => ({ id, visible: true })),
    });
  }

  if (definition.type === 'tile') {
    return new TileLayer(common);
  }

  return new FeatureLayer({
    ...common,
    outFields: ['*'],
    popupTemplate: popupTemplate(definition.label),
  });
}
