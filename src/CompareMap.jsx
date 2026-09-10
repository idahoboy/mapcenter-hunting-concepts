import { useRef, useState } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import { Crosshair, Layers3, MapPinned, Scan } from 'lucide-react';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-scale-bar';

const boundaryStyles = [
  { fill: [184, 84, 38, 0.28], line: [137, 55, 23, 1], css: '#b85426' },
  { fill: [41, 104, 79, 0.24], line: [25, 78, 57, 1], css: '#29684f' },
];

function CompareMap({ hunts }) {
  const mapRef = useRef(null);
  const extentsRef = useRef(new Map());
  const allExtentRef = useRef(null);
  const [status, setStatus] = useState('Loading saved hunt boundaries.');

  const handleMapReady = async (event) => {
    const mapElement = event.target;
    if (!mapElement?.map || mapElement.dataset.planLoaded) return;
    mapElement.dataset.planLoaded = 'true';
    mapElement.view.aria = {
      label: 'My Hunt Plan boundary comparison map',
      description: 'Interactive map showing the boundaries of every saved hunt in the current comparison.',
    };

    const layers = hunts.map((hunt, index) => {
      const style = boundaryStyles[index % boundaryStyles.length];
      return new FeatureLayer({
        url: hunt.map.url,
        definitionExpression: hunt.map.where,
        outFields: ['*'],
        title: hunt.areaLabel,
        popupEnabled: false,
        renderer: {
          type: 'simple',
          symbol: {
            type: 'simple-fill',
            color: style.fill,
            outline: { color: style.line, width: 2.5 },
          },
        },
      });
    });

    mapElement.map.addMany(layers);
    try {
      const results = await Promise.all(layers.map(async (layer, index) => {
        await layer.load();
        const result = await layer.queryExtent({ where: hunts[index].map.where });
        if (result.extent) extentsRef.current.set(hunts[index].id, result.extent);
        return result.extent;
      }));
      const extents = results.filter(Boolean);
      if (extents.length) {
        const combined = extents[0].clone();
        extents.slice(1).forEach((extent) => combined.union(extent));
        allExtentRef.current = combined;
        await mapElement.view.goTo(combined.expand(1.18), {
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
        });
      }
      setStatus(`${extents.length} of ${hunts.length} saved hunt boundaries loaded.`);
    } catch {
      setStatus('Some saved hunt boundaries are temporarily unavailable.');
    }
  };

  const focusHunt = async (hunt) => {
    const extent = extentsRef.current.get(hunt.id);
    if (!extent || !mapRef.current?.view) return;
    await mapRef.current.view.goTo(extent.expand(1.22), {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
    });
    setStatus(`Map focused on ${hunt.areaLabel}.`);
  };

  const showAll = async () => {
    if (!allExtentRef.current || !mapRef.current?.view) return;
    await mapRef.current.view.goTo(allExtentRef.current.expand(1.18), {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
    });
    setStatus(`${hunts.length} saved hunt boundaries shown together.`);
  };

  return (
    <section className="compare-map-section" aria-labelledby="compare-map-title">
      <div className="compare-map-heading">
        <div><span><Layers3 size={16} />Spatial comparison</span><h2 id="compare-map-title">See the choices in context</h2></div>
        <p>{status}</p>
      </div>
      <div className="compare-map-frame">
        <arcgis-map ref={mapRef} basemap="topo-vector" center="-114.2,45.4" zoom="6" onarcgisViewReadyChange={handleMapReady}>
          <arcgis-zoom slot="top-left" />
          <arcgis-scale-bar slot="bottom-left" unit="dual" />
        </arcgis-map>
        <div className="compare-map-legend" aria-label="Saved hunt boundary legend">
          <span className="compare-map-legend-title"><span><MapPinned size={15} />Saved boundaries</span><button onClick={showAll} aria-label="Show all saved hunt boundaries"><Scan size={13} />All</button></span>
          {hunts.map((hunt, index) => <button key={hunt.id} onClick={() => focusHunt(hunt)}><i style={{ '--boundary-color': boundaryStyles[index % boundaryStyles.length].css }} />{hunt.areaLabel}<Crosshair size={13} /></button>)}
        </div>
      </div>
    </section>
  );
}

export default CompareMap;
