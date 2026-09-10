import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Bookmark, ChevronRight, ExternalLink, Scale, X } from 'lucide-react';
import CompareMap from './CompareMap.jsx';
import SiteHeader from './SiteHeader.jsx';
import { useHuntPlan } from './useHuntPlan.js';
import { fetchCatalog } from './huntPlannerApi.js';

const comparisonRows = [
  { label: 'Season dates', value: (hunt) => hunt.dates },
  { label: 'Tag', value: (hunt) => hunt.tag },
  { label: 'Availability', value: (hunt) => hunt.tagAvailability },
  { label: 'Legal method', value: (hunt) => hunt.method },
  { label: 'Species / sex', value: (hunt) => `${hunt.species} · ${hunt.sex}` },
  { label: 'Area', value: (hunt) => hunt.areaLabel },
  { label: 'Season classification', value: (hunt) => hunt.season },
  { label: 'API record', value: (hunt) => `Hunt ${hunt.id} · tag ${hunt.tagId}` },
];

function ComparePage() {
  const { huntIds, toggle } = useHuntPlan();
  const [displayOpen, setDisplayOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [apiState, setApiState] = useState('loading');
  const selected = huntIds.map((id) => catalog.find((hunt) => hunt.id === id)).filter(Boolean);

  useEffect(() => {
    document.documentElement.dataset.motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
    fetchCatalog().then((records) => { setCatalog(records); setApiState('ready'); }).catch(() => setApiState('error'));
  }, []);

  return (
    <div className="compare-shell">
      <a className="skip-link" href="#comparison">Skip to comparison</a>
      <SiteHeader activeView="plan" onDisplay={() => setDisplayOpen(!displayOpen)} displayExpanded={displayOpen}>
        {displayOpen && <section id="accessibility-panel" className="accessibility-panel compare-display" aria-label="Display and accessibility settings"><div className="panel-heading"><div><span className="eyebrow">Display</span><h2>Accessible by design</h2></div><button className="close-button" onClick={() => setDisplayOpen(false)} aria-label="Close display settings"><X /></button></div><p>Comparison uses semantic headings, row labels, high-contrast text, keyboard-visible controls, and a stacked mobile layout.</p></section>}
      </SiteHeader>
      <main id="comparison">
        <div className="compare-breadcrumb"><a href="/search"><ArrowLeft size={15} />Opportunity search</a></div>
        <header className="compare-hero"><span><Scale size={18} />Decision workspace</span><h1>Compare your hunt plan</h1><p>See the practical differences first, then return to each official record before making an application or purchase decision.</p></header>

        {apiState === 'loading' ? (
          <section className="empty-plan"><Bookmark size={28} /><h2>Loading your live hunt plan…</h2><p>Resolving saved IDs against Hunt Planner API 1.1.</p></section>
        ) : !selected.length ? (
          <section className="empty-plan"><Bookmark size={28} /><h2>Your plan is ready for a first choice</h2><p>Save authoritative opportunities from the live Hunt Planner search.</p><a href="/search">Browse live opportunities <ChevronRight size={15} /></a></section>
        ) : (
          <>
            <CompareMap key={huntIds.join('-')} hunts={selected} />
            <div className={`comparison-grid columns-${selected.length}`}>
              <div className="comparison-label-head"><span>Compared facts</span></div>
              {selected.map((hunt) => <article className="compare-hunt-head" key={hunt.id}><div><small>{hunt.kind}</small><h2>{hunt.areaLabel}</h2><p>{hunt.species}</p></div><button onClick={() => toggle(hunt.id)} aria-label={`Remove ${hunt.areaLabel} from comparison`}><X size={16} /></button><a href={`/hunt/${hunt.id}`}>Open details <ChevronRight size={14} /></a></article>)}
              {comparisonRows.map((row) => <div className="comparison-row" key={row.label}><h3>{row.label}</h3>{selected.map((hunt) => <div key={`${row.label}-${hunt.id}`}>{row.value(hunt)}</div>)}</div>)}
            </div>
          </>
        )}

        {selected.length === 1 && <aside className="add-other"><div><strong>Add another live hunt</strong><p>Comparison becomes more useful when alternatives share the same decision frame.</p></div><a href="/search">Browse API results <ChevronRight size={15} /></a></aside>}

        {selected.length > 0 && <aside className="compare-warning"><AlertTriangle size={19} /><p><strong>Live API comparison, not the legal record.</strong> These facts are current API 1.1 responses; verify regulations and legal boundaries before hunting.</p><div>{selected.map((hunt) => <a href={hunt.sourceUrl} key={hunt.id}>Official hunt {hunt.id} <ExternalLink size={12} /></a>)}</div></aside>}
      </main>
    </div>
  );
}

export default ComparePage;
