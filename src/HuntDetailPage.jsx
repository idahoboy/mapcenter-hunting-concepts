import { useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, BookmarkCheck, CalendarDays, ChevronRight, Crosshair, Database, ExternalLink, MapPin, PawPrint, ShoppingCart, Target, X } from 'lucide-react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import SiteHeader from './SiteHeader.jsx';
import { fetchHunt } from './huntPlannerApi.js';
import { useHuntPlan } from './useHuntPlan.js';
import './hunt-detail.css';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

function HuntDetailPage({ huntId }) {
  const [hunt, setHunt] = useState(null);
  const [apiState, setApiState] = useState('loading');
  const [displayOpen, setDisplayOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [largeText, setLargeText] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState('Loading Hunt Planner API 1.1.');
  const { isSaved, toggle } = useHuntPlan();

  useEffect(() => {
    let active = true;
    fetchHunt(huntId).then((record) => {
      if (!active) return;
      setHunt(record);
      setApiState(record ? 'ready' : 'missing');
      setStatus(record ? `Hunt ${huntId} loaded from Hunt Planner API 1.1.` : `Hunt ${huntId} was not found in the live 2026 catalog.`);
    }).catch(() => {
      if (!active) return;
      setApiState('error');
      setStatus('Hunt Planner API 1.1 is temporarily unavailable.');
    });
    return () => { active = false; };
  }, [huntId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.textSize = largeText ? 'large' : 'default';
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [theme, largeText, reducedMotion]);

  const loadBoundary = async (event) => {
    const mapElement = event.target;
    if (!hunt || !mapElement?.map || mapElement.dataset.huntLoaded) return;
    mapElement.dataset.huntLoaded = hunt.id;
    mapElement.view.aria = { label: `${hunt.areaLabel} map context`, description: `GMU context for live Hunt Planner record ${hunt.id}.` };
    if (!hunt.map) {
      setStatus(`${hunt.areaLabel} does not resolve to one GMU in API 1.1.`);
      return;
    }
    const boundary = new FeatureLayer({
      url: hunt.map.url,
      definitionExpression: hunt.map.where,
      outFields: ['*'],
      popupEnabled: false,
      title: `GMU ${hunt.unit}`,
      renderer: { type: 'simple', symbol: { type: 'simple-fill', color: [197, 99, 48, .24], outline: { color: [128, 61, 28, 1], width: 2.5 } } },
    });
    mapElement.map.add(boundary);
    try {
      await boundary.load();
      const result = await boundary.queryExtent({ where: hunt.map.where });
      if (result.extent) await mapElement.view.goTo(result.extent.expand(1.35), { duration: reducedMotion ? 0 : 550 });
      setStatus(`GMU ${hunt.unit} context loaded.`);
    } catch {
      setStatus('The mapped GMU is temporarily unavailable.');
    }
  };

  if (apiState !== 'ready') {
    const title = apiState === 'loading' ? 'Loading live hunt…' : apiState === 'missing' ? 'Hunt not found' : 'Live data unavailable';
    return <div className="hunt-detail-shell"><SiteHeader activeView="detail" /><main className="detail-state"><Database size={30} /><h1>{title}</h1><p>{status}</p><a href="/search"><ArrowLeft size={15} />Return to live search</a></main></div>;
  }

  const saved = isSaved(hunt.id);
  return (
    <div className="hunt-detail-shell">
      <a className="skip-link" href="#hunt-overview">Skip to hunt details</a>
      <p className="sr-only" aria-live="polite">{status}</p>
      <SiteHeader activeView="detail" onDisplay={() => setDisplayOpen(!displayOpen)} displayExpanded={displayOpen}>
        {displayOpen && (
          <section id="accessibility-panel" className="accessibility-panel detail-accessibility" aria-label="Display and accessibility settings">
            <div className="panel-heading"><div><span className="eyebrow">Display</span><h2>Make it yours</h2></div><button className="close-button" onClick={() => setDisplayOpen(false)} aria-label="Close display settings"><X /></button></div>
            <label className="setting-row"><span><strong>High-contrast theme</strong><small>Increase foreground contrast</small></span><input type="checkbox" checked={theme === 'contrast'} onChange={(event) => setTheme(event.target.checked ? 'contrast' : 'light')} /></label>
            <label className="setting-row"><span><strong>Larger interface text</strong><small>Increase labels and controls</small></span><input type="checkbox" checked={largeText} onChange={(event) => setLargeText(event.target.checked)} /></label>
            <label className="setting-row"><span><strong>Reduce motion</strong><small>Limit animated transitions</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
          </section>
        )}
      </SiteHeader>

      <main id="hunt-overview">
        <div className="detail-breadcrumbs"><a href="/search"><ArrowLeft size={15} />Live search</a><ChevronRight size={14} /><span>Hunt {hunt.id}</span></div>
        <section className="hunt-hero">
          <div>
            <div className="hunt-kicker"><span>{hunt.kind}</span><span>API {hunt.apiVersion} live</span></div>
            <h1>{hunt.areaLabel}</h1>
            <p className="hunt-season">{hunt.tag}</p>
            <p className="hunt-summary">{hunt.season}</p>
            <div className="hunt-meta-grid">
              <div><CalendarDays /><span><small>Season dates</small><strong>{hunt.dates}</strong></span></div>
              <div><PawPrint /><span><small>Species</small><strong>{hunt.species}</strong></span></div>
              <div><Target /><span><small>Method</small><strong>{hunt.method}</strong></span></div>
              <div><MapPin /><span><small>Area</small><strong>{hunt.areaLabel}</strong></span></div>
            </div>
          </div>
          <aside className="tag-card" aria-label="Tag summary">
            <span className="tag-card-label">Live tag record</span><h2>{hunt.tag}</h2>
            {hunt.huntNumber && <p>Hunt #{hunt.huntNumber}</p>}
            <div className="tag-availability"><Database size={17} /><span><strong>{hunt.tagAvailability}</strong><small>Hunt Planner API 1.1</small></span></div>
            <button className={saved ? 'save-hunt saved' : 'save-hunt'} onClick={() => toggle(hunt.id)} aria-pressed={saved}>{saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}{saved ? 'Saved to My plan' : 'Save to My plan'}</button>
            <a className="tag-primary" href="https://idfg.idaho.gov/buy_online/"><ShoppingCart size={17} />License & tag options</a>
            <a className="tag-secondary" href={hunt.sourceUrl}>View official record <ExternalLink size={14} /></a>
          </aside>
        </section>

        <div className="detail-layout live-detail-layout">
          <div className="detail-main-column">
            <section className="detail-section">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Live GIS context</span><h2>Map the hunt area</h2></div></div>
              <div className="detail-map">
                <arcgis-map basemap="topo-vector" center="-114.52,45.5" zoom="6" onarcgisViewReadyChange={loadBoundary}><arcgis-zoom slot="top-left" /><arcgis-locate slot="top-left" /><arcgis-scale-bar slot="bottom-left" unit="dual" /></arcgis-map>
                <span className="detail-map-label"><Crosshair size={15} />{hunt.unit ? `GMU ${hunt.unit} context` : 'Statewide context'}</span>
              </div>
              <div className="restriction-callout"><Database size={18} /><div><strong>Boundary join is intentionally conservative</strong><p>API 1.1 identifies the hunt area by name, but its current public list response does not return the <code>areaid</code> used to join the official Hunt Area GIS feature. The map shows inferred GMU context when available; use the official record for the legal hunt boundary.</p></div></div>
            </section>

            <section className="detail-section">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Authoritative response</span><h2>Season record</h2></div></div>
              <div className="rules-grid">
                <div><small>Season</small><strong>{hunt.season}</strong></div>
                <div><small>Open–close</small><strong>{hunt.dates}</strong></div>
                <div><small>Species / sex</small><strong>{hunt.species} · {hunt.sex}</strong></div>
                <div><small>Legal method</small><strong>{hunt.method}</strong></div>
                <div><small>Tag area</small><strong>{hunt.tagArea}</strong></div>
                <div><small>Permit quantity</small><strong>{hunt.tagAvailability}</strong></div>
              </div>
            </section>
          </div>
          <aside className="detail-side-column">
            <section><span className="detail-eyebrow">Data provenance</span><h2>Nothing invented</h2><p className="season-note">Every hunt fact on this page is returned by Hunt Planner API 1.1. GIS geometry remains live from the configured Esri services.</p><a className="tag-primary provenance-link" href={hunt.sourceUrl}>Official Hunt Planner <ExternalLink size={14} /></a></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default HuntDetailPage;
