import { ArrowRight, BookmarkCheck, X } from 'lucide-react';
import { useHuntPlan } from './useHuntPlan.js';

function PlanTray() {
  const { huntIds, toggle } = useHuntPlan();
  if (!huntIds.length || window.location.pathname.startsWith('/compare')) return null;

  return (
    <aside className="plan-tray" aria-label="My plan">
      <span className="plan-tray-title"><BookmarkCheck size={18} /><span><small>My plan</small><strong>{huntIds.length} saved {huntIds.length === 1 ? 'opportunity' : 'opportunities'}</strong></span></span>
      <div className="plan-tray-items">{huntIds.map((id) => <span key={id}>Hunt {id}<button onClick={() => toggle(id)} aria-label={`Remove hunt ${id} from plan`}><X size={12} /></button></span>)}</div>
      <a href="/compare">Compare <ArrowRight size={15} /></a>
    </aside>
  );
}

export default PlanTray;
