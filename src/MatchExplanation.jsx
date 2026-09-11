import { CheckCircle2, ChevronDown, Layers3, Sparkles } from 'lucide-react';
import { buildMatchEvidence } from './matchEvidence.js';

export default function MatchExplanation({ hunt, plan, regionLookup, layers }) {
  const evidence = buildMatchEvidence(hunt, plan, regionLookup, layers);
  if (!plan || (!evidence.criteria.length && !evidence.contextLayers.length)) return null;

  return (
    <details className="match-explanation">
      <summary><span><Sparkles size={13} />Why this matched</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="match-explanation-body">
        {evidence.criteria.length > 0 && <div className="match-criteria">
          <strong>Verified matches</strong>
          {evidence.criteria.map((item) => (
            <div key={item.id}>
              <CheckCircle2 size={13} aria-hidden="true" />
              <span><b>{item.label}:</b> {item.value}<small>{item.source}</small></span>
            </div>
          ))}
        </div>}
        {evidence.contextLayers.length > 0 && <div className="match-context">
          <strong><Layers3 size={13} />Map context enabled</strong>
          <p>{evidence.contextLayers.map((layer) => layer.label).join(' · ')}</p>
          <small>Review these layers on the map; visibility does not by itself establish legal access.</small>
        </div>}
      </div>
    </details>
  );
}
