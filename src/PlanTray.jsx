import { ArrowRight, BookmarkCheck, X } from 'lucide-react';
import { useHuntPlan } from './useHuntPlan.js';

const labels = { '82313': 'Elk · 30A-1', '78813': 'Bear · Unit 13' };

function PlanTray() {
  const { huntIds, toggle } = useHuntPlan();
  if (!huntIds.length || window.location.pathname.startsWith('/compare')) return null;

  return (
    <aside className="plan-tray" aria-label="My Hunt Plan">
      <span className="plan-tray-title"><BookmarkCheck size={18} /><span><small>My Hunt Plan</small><strong>{huntIds.length} saved {huntIds.length === 1 ? 'hunt' : 'hunts'}</strong></span></span>
      <div className="plan-tray-items">{huntIds.map((id) => <span key={id}>{labels[id]}<button onClick={() => toggle(id)} aria-label={`Remove ${labels[id]} from plan`}><X size={12} /></button></span>)}</div>
      <a href="/compare">Compare <ArrowRight size={15} /></a>
    </aside>
  );
}

export default PlanTray;
