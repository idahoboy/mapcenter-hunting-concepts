import { AlertCircle, Crosshair, LoaderCircle, MapPin, ScanSearch, X } from 'lucide-react';

function LocationSummaryPopup({ summary, onClose, onZoom }) {
  if (!summary) return null;
  const categories = [...new Set(summary.matches.map((match) => match.category))];

  return (
    <aside
      className="location-summary-popup"
      style={{ '--identify-x': `${summary.x}px`, '--identify-y': `${summary.y}px` }}
      aria-label="Map location summary"
      aria-live="polite"
    >
      <header>
        <span className="identify-icon"><MapPin size={18} /></span>
        <span><small>What’s here?</small><strong>{summary.latitude.toFixed(5)}, {summary.longitude.toFixed(5)}</strong></span>
        <button onClick={onClose} aria-label="Close location summary"><X size={18} /></button>
      </header>
      {summary.loading ? (
        <div className="identify-loading"><LoaderCircle size={20} /><span>Checking visible boundaries…</span></div>
      ) : summary.matches.length ? (
        <div className="identify-results">
          {categories.map((category) => (
            <section key={category}>
              <h3>{category}</h3>
              {summary.matches.filter((match) => match.category === category).map((match) => (
                <article key={match.id}>
                  <span><strong>{match.title}</strong><small>{match.layer}</small></span>
                  {match.note && <p>{match.note}</p>}
                  {match.facts.length > 0 && <dl>{match.facts.map((fact) => <div key={`${match.id}-${fact.label}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
                  {match.geometry && <button className="identify-zoom" onClick={() => onZoom(match)}><ScanSearch size={14} />Zoom to {match.geometry.extent ? 'boundary' : 'location'}</button>}
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="identify-empty"><AlertCircle size={20} /><div><strong>No visible boundary matched</strong><p>Turn on more polygon layers or choose another location.</p></div></div>
      )}
      <footer><Crosshair size={14} />Results reflect the layers currently turned on.</footer>
    </aside>
  );
}

export default LocationSummaryPopup;
