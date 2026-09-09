import { useEffect, useRef, useState } from 'react';
import { identifyVisibleLayers } from './locationIdentify.js';

export function useMapIdentify(layerInstances, definitions) {
  const [summary, setSummary] = useState(null);
  const clickHandle = useRef(null);
  const requestId = useRef(0);

  useEffect(() => () => clickHandle.current?.remove(), []);

  const attach = (view) => {
    clickHandle.current?.remove();
    view.popupEnabled = false;
    clickHandle.current = view.on('click', async (event) => {
      const currentRequest = ++requestId.current;
      const longitude = event.mapPoint.longitude ?? event.mapPoint.x;
      const latitude = event.mapPoint.latitude ?? event.mapPoint.y;
      const position = {
        x: Math.min(Math.max(event.x, 176), Math.max(176, view.width - 176)),
        y: Math.min(Math.max(event.y, 138), Math.max(138, view.height - 220)),
      };
      setSummary({ ...position, longitude, latitude, loading: true, matches: [] });
      const matches = await identifyVisibleLayers(definitions, layerInstances.current, event.mapPoint);
      if (currentRequest !== requestId.current) return;
      setSummary({ ...position, longitude, latitude, loading: false, matches });
    });
  };

  const close = () => {
    requestId.current += 1;
    setSummary(null);
  };

  return { summary, attach, close };
}
