import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Bookmark, Check, ChevronRight, ExternalLink, Scale, X } from 'lucide-react';
import { hunts } from './HuntDetailPage.jsx';
import SiteHeader from './SiteHeader.jsx';
import { useHuntPlan } from './useHuntPlan.js';

const comparisonRows = [
  { label: 'Season dates', value: (hunt) => hunt.dates },
  { label: 'Tag path', value: (hunt) => `${hunt.tagAvailability} · ${hunt.status}` },
  { label: 'Legal method', value: (hunt) => hunt.method },
  { label: 'Area', value: (hunt) => `${hunt.areaLabel} · ${hunt.areaSize}` },
  { label: 'Access reality', value: (hunt) => hunt.note },
  { label: 'Recent outcome', value: (hunt) => hunt.id === '82313' ? '50% success · 5 harvested by 10 hunters (2025)' : '43 harvested · 27 boars and 16 sows (2015)' },
  { label: 'Drawing', value: (hunt) => hunt.odds ? `${hunt.odds[0].success} first-choice success in ${hunt.odds[0].year}` : 'No controlled-hunt drawing' },
  { label: 'Land context', value: (hunt) => hunt.ownership.length ? '71.5% private · 10.2% BLM · 8.8% USFS' : 'Agency acreage unavailable in source record' },
];

function ComparePage() {
  const { huntIds, toggle, addAll } = useHuntPlan();
  const [displayOpen, setDisplayOpen] = useState(false);
  const selected = huntIds.map((id) => hunts[id]).filter(Boolean);

  useEffect(() => {
    document.documentElement.dataset.motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
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

        {!selected.length ? (
          <section className="empty-plan"><Bookmark size={28} /><h2>Your plan is ready for a first choice</h2><p>Save hunts from search results or start with the two source-backed examples in this concept.</p><button onClick={addAll}>Add both example hunts</button><a href="/search">Browse opportunities <ChevronRight size={15} /></a></section>
        ) : (
          <div className={`comparison-grid columns-${selected.length}`}>
            <div className="comparison-label-head"><span>Compared facts</span></div>
            {selected.map((hunt) => <article className="compare-hunt-head" key={hunt.id}><div><small>{hunt.kind}</small><h2>{hunt.areaLabel}</h2><p>{hunt.species}</p></div><button onClick={() => toggle(hunt.id)} aria-label={`Remove ${hunt.areaLabel} from comparison`}><X size={16} /></button><a href={`/hunt/${hunt.id}`}>Open details <ChevronRight size={14} /></a></article>)}
            {comparisonRows.map((row) => <div className="comparison-row" key={row.label}><h3>{row.label}</h3>{selected.map((hunt) => <div key={`${row.label}-${hunt.id}`}>{row.value(hunt)}</div>)}</div>)}
          </div>
        )}

        {selected.length === 1 && <aside className="add-other"><div><strong>Add a second hunt</strong><p>Comparison becomes more useful when alternatives share the same decision frame.</p></div>{Object.values(hunts).filter((hunt) => !huntIds.includes(hunt.id)).map((hunt) => <button key={hunt.id} onClick={() => toggle(hunt.id)}><Check size={15} />Add {hunt.areaLabel}</button>)}</aside>}

        {selected.length > 0 && <aside className="compare-warning"><AlertTriangle size={19} /><p><strong>Planning comparison, not the legal record.</strong> Seasons, quotas, access, and rules can change. Verify each selection with Idaho Fish and Game.</p><div>{selected.map((hunt) => <a href={hunt.sourceUrl} key={hunt.id}>Official {hunt.areaLabel} <ExternalLink size={12} /></a>)}</div></aside>}
      </main>
    </div>
  );
}

export default ComparePage;
