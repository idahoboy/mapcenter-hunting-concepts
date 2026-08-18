import { load } from 'js-yaml';
import rawConfig from './config/hunt-planner.yml?raw';

const config = load(rawConfig);

export const allLayers = config.layerGroups.flatMap((group) =>
  group.layers.map((layer) => ({ ...layer, groupId: group.id })),
);

export default config;
