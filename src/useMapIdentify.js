import { useEffect, useRef, useState } from 'react';
import { identifyVisibleLayers } from './locationIdentify.js';

export function useMapIdentify(layerInstances, definitions) {
  const [summary, setSummary] = useState(null);
  const clickHandle = useRef(null);
  const requestId = useRef(0);
  const viewRef = useRef(null);

  useEffect(() => () => clickHandle.current?.remove(), []);

  const attach = (view) => {
    viewRef.current = view;
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

  const zoomTo = async (match) => {
    const view = viewRef.current;
    const geometry = match?.geometry;
    if (!view || !geometry) return;
    const reducedMotion = document.documentElement.dataset.motion === 'reduced';
    const target = geometry.extent
      ? geometry.extent.expand(1.18)
      : { target: geometry, zoom: Math.max(view.zoom, 14) };
    close();
    await view.goTo(target, { duration: reducedMotion ? 0 : 550 });
  };

  return { summary, attach, close, zoomTo };
}
