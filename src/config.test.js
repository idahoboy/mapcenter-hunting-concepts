import { describe, expect, it } from 'vitest';
import config, { allLayers } from './config.js';
import { deriveLayerStack } from './layerIntelligence.js';

describe('hunt planner YAML configuration', () => {
  it('uses unique ids for activities, groups, and layers', () => {
    const activityIds = config.activities.map((item) => item.id);
    const groupIds = config.layerGroups.map((item) => item.id);
    const layerIds = allLayers.map((item) => item.id);

    expect(new Set(activityIds).size).toBe(activityIds.length);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(new Set(layerIds).size).toBe(layerIds.length);
  });

  it('references only configured layers from activity presets', () => {
    const layerIds = new Set(allLayers.map((item) => item.id));
    const missing = config.activities.flatMap((activity) =>
      activity.suggestedLayers.filter((id) => !layerIds.has(id)),
    );

    expect(missing).toEqual([]);
  });

  it('uses secure public service URLs', () => {
    expect(allLayers.every((layer) => layer.url.startsWith('https://'))).toBe(true);
  });

  it('derives layer rankings from search signals instead of activity presets', () => {
    const ranked = deriveLayerStack(
      allLayers,
      'fall elk hunt with public access and fewer motor restrictions',
      { huntType: 'Any hunt type' },
    );
    const leadingIds = ranked.slice(0, 5).map((layer) => layer.id);

    expect(leadingIds).toContain('elk-zones');
    expect(leadingIds).toContain('access-yes');
    expect(leadingIds).toContain('motorized-rules');
  });

  it('promotes controlled hunt geography when the filter requests it', () => {
    const ranked = deriveLayerStack(allLayers, 'elk near Boise', { huntType: 'Controlled hunt' });

    expect(ranked.findIndex((layer) => layer.id === 'controlled-hunts')).toBeLessThan(5);
  });
});
