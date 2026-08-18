import { Accessibility, FileText, Map as MapIcon, MapPin, Search } from 'lucide-react';
import config from './config.js';

function SiteHeader({ activeView, displayExpanded = false, onDisplay, children }) {
  return (
    <header className="search-site-header shared-site-header">
      <a className="search-brand" href="/" aria-label="Idaho Hunt Planner home">
        <span className="brand-mark" aria-hidden="true"><MapPin size={21} /></span>
        <span><small>{config.app.eyebrow}</small>{config.app.name}</span>
      </a>
      <nav aria-label="Planner views">
        <a className={activeView === 'map' ? 'active' : ''} href="/" aria-label="Map center">
          <MapIcon size={17} /><span>Map center</span>
        </a>
        <a className={activeView === 'search' ? 'active' : ''} href="/search" aria-label="Opportunity search">
          <Search size={17} /><span>Opportunity search</span>
        </a>
        <a className={activeView === 'detail' ? 'active' : ''} href="/hunt/82313" aria-label="Hunt details">
          <FileText size={17} /><span>Hunt details</span>
        </a>
      </nav>
      <button
        className="search-display-button"
        onClick={onDisplay}
        aria-label="Display and accessibility settings"
        aria-expanded={displayExpanded}
        aria-controls={onDisplay ? 'accessibility-panel' : undefined}
      >
        <Accessibility size={19} /><span>Display</span>
      </button>
      {children}
    </header>
  );
}

export default SiteHeader;
