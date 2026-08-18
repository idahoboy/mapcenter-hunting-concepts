import { useEffect, useRef, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Crosshair,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  Map as MapIcon,
  MapPin,
  PawPrint,
  ShoppingCart,
  Target,
  Trees,
  X,
} from 'lucide-react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import SiteHeader from './SiteHeader.jsx';
import './hunt-detail.css';

import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-locate';
import '@arcgis/map-components/components/arcgis-scale-bar';

const hunts = {
  '82313': {
    id: '82313',
    kind: 'Controlled hunt',
    species: 'Elk',
    scientificName: 'Cervus canadensis',
    season: 'Elk Controlled Hunt Either Sex Season',
    areaLabel: 'Hunt Area 30A-1',
    unit: '30A',
    tag: 'Elk Controlled Hunt 2111',
    huntNumber: '2111',
    tagAvailability: '10 tags',
    dates: 'Aug 1–29, 2026',
    sex: 'Either sex',
    method: 'Any weapon',
    methodDetail: 'Rifle, archery, muzzleloader, shotgun, or handgun.',
    status: 'Application required',
    summary: 'A short, controlled either-sex elk season in a defined portion of Unit 30A.',
    warning: 'Extremely limited access. Obtain permission to hunt private land before buying this tag.',
    note: 'Portion of unit only. Access is extremely limited and most elk are found on private property.',
    areaSize: '40,492 acres',
    boundary: 'That portion of Unit 30A beginning at Highways 28 and 29, following Highway 29 and the USFS administrative boundary to Dry Canyon Road, then 18 Mile and Clear Creek roads, and returning north on Highway 28.',
    map: {
      url: 'https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer/0',
      where: 'ID = 2830',
      center: '-113.05,44.05',
      zoom: 10,
    },
    harvestColumns: ['Year', 'Hunt #', 'Area', 'Hunters', 'Harvest', 'Success', 'Days', 'Antlered', 'Antlerless'],
    harvestRows: [['2025', '2111', '30A-1', '10', '5', '50%', '67', '3', '2']],
    odds: [
      { year: '2026', applicants: '30', permits: '10', success: '33%' },
      { year: '2025', applicants: '16', permits: '10', success: '62%' },
    ],
    residentTags: ['Adult Elk Tag', 'Jr./Sr./DAV Elk Tag', 'Controlled Hunt Application Fee'],
    nonresidentTags: ['Junior Mentored Elk Tag', 'Adult Elk Tag', 'Controlled Hunt Application Fee'],
    ownership: [],
    access: 'No Access Yes! properties are currently available in this hunt area.',
    sourceUrl: 'https://idfg.idaho.gov/ifwis/huntplanner/hunt/82313',
    pdfUrl: 'https://idfg.idaho.gov/ifwis/huntplanner/download/pdf/hunt_ID2830.pdf',
  },
  '78813': {
    id: '78813',
    kind: 'General season',
    species: 'American black bear',
    scientificName: 'Ursus americanus',
    season: 'Bear General Any Weapon Season',
    areaLabel: 'Unit 13',
    unit: '13',
    tag: 'General Black Bear Tag',
    huntNumber: null,
    tagAvailability: 'Unlimited tags',
    dates: 'Apr 15–May 31, 2026',
    sex: 'Either-sex black bear',
    method: 'Any weapon',
    methodDetail: 'Rifle, archery, muzzleloader, shotgun, or handgun.',
    status: 'General tag',
    summary: 'A spring general-season black bear opportunity covering all of Game Management Unit 13.',
    warning: 'No female black bear accompanied by young may be taken.',
    note: 'Dogs are prohibited April 15–30.',
    areaSize: '220,527 acres',
    boundary: 'All of Unit 13.',
    map: {
      url: 'https://services.arcgis.com/FjJI5xHF2dUPVrgK/ArcGIS/rest/services/GameManagementUnits/FeatureServer/0',
      where: "NAME = '13'",
      center: '-116.35,45.63',
      zoom: 9,
    },
    harvestColumns: ['Year', 'Unit', 'Harvest', 'Boars', 'Sows', 'Fall', 'Spring', 'Bait', 'Hounds', 'Still stalk'],
    harvestRows: [
      ['2015', '13', '43', '27', '16', '13', '30', '23', '10', '4'],
      ['2014', '13', '31', '—', '—', '12', '19', '15', '—', '12'],
      ['2013', '13', '28', '—', '—', '11', '17', '13', '2', '8'],
    ],
    odds: null,
    residentTags: ['Adult Bear Tag', 'Jr./Sr./DAV Bear Tag', 'Hound Hunter Permit*', 'Bear Bait Permit*'],
    nonresidentTags: ['Junior Mentored Bear Tag', 'Adult Bear Tag', 'Bear Bait Permit*', 'Hound Hunter Permit*'],
    ownership: [
      { label: 'Private', acres: '157,753', value: 71.5, color: '#b98a62' },
      { label: 'BLM', acres: '22,555', value: 10.2, color: '#d0a64f' },
      { label: 'US Forest Service', acres: '19,476', value: 8.8, color: '#567d5b' },
      { label: 'State of Idaho', acres: '18,544', value: 8.4, color: '#708d9f' },
      { label: 'Other', acres: '1,520', value: 0.7, color: '#a8aaa3' },
    ],
    access: 'No Access Yes! properties are currently available in this hunt area.',
    sourceUrl: 'https://idfg.idaho.gov/ifwis/huntplanner/hunt/78813',
    pdfUrl: 'https://idfg.idaho.gov/ifwis/huntplanner/download/pdf/hunt_ID188.pdf',
  },
};

function StatTable({ columns, rows, caption }) {
  return (
    <div className="detail-table-wrap" tabIndex="0">
      <table className="detail-table">
        <caption>{caption}</caption>
        <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.join('-')}>{row.map((value, index) => <td key={`${index}-${value}`}>{value}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function HuntDetailPage({ huntId }) {
  const hunt = hunts[huntId] ?? hunts['82313'];
  const mapRef = useRef(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const [largeText, setLargeText] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState('Loading hunt boundary.');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.textSize = largeText ? 'large' : 'default';
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [theme, largeText, reducedMotion]);

  const handleMapReady = async (event) => {
    const mapElement = event.target;
    if (!mapElement?.map || mapElement.dataset.huntLoaded === hunt.id) return;
    mapElement.dataset.huntLoaded = hunt.id;
    const boundary = new FeatureLayer({
      url: hunt.map.url,
      definitionExpression: hunt.map.where,
      outFields: ['*'],
      opacity: 0.72,
      title: hunt.areaLabel,
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: [197, 99, 48, 0.24],
          outline: { color: [128, 61, 28, 1], width: 2.5 },
        },
      },
    });
    mapElement.map.add(boundary);
    mapElement.view.aria = {
      label: `${hunt.areaLabel} boundary map`,
      description: `Interactive map showing the official GIS boundary used for ${hunt.tag}.`,
    };
    try {
      await boundary.load();
      const result = await boundary.queryExtent({ where: hunt.map.where });
      if (result.extent) await mapElement.view.goTo(result.extent.expand(1.35), { duration: reducedMotion ? 0 : 550 });
      setStatus(`${hunt.areaLabel} boundary loaded.`);
    } catch {
      setStatus(`${hunt.areaLabel} selected. The boundary service is temporarily unavailable.`);
    }
  };

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
        <div className="detail-breadcrumbs" aria-label="Breadcrumb">
          <a href="/search"><ArrowLeft size={15} />Search results</a><ChevronRight size={14} /><span>{hunt.areaLabel}</span>
        </div>

        <section className="hunt-hero">
          <div className="hunt-hero-copy">
            <div className="hunt-kicker"><span>{hunt.kind}</span><span>2026 season</span></div>
            <h1>{hunt.areaLabel}</h1>
            <p className="hunt-season">{hunt.season}</p>
            <p className="hunt-summary">{hunt.summary}</p>
            <div className="hunt-meta-grid">
              <div><CalendarDays /><span><small>Season dates</small><strong>{hunt.dates}</strong></span></div>
              <div><PawPrint /><span><small>Species</small><strong>{hunt.species}</strong></span></div>
              <div><Target /><span><small>Method</small><strong>{hunt.method}</strong></span></div>
              <div><MapPin /><span><small>Game unit</small><strong>{hunt.unit}</strong></span></div>
            </div>
          </div>
          <aside className="tag-card" aria-label="Tag summary">
            <span className="tag-card-label">Tag & permit</span>
            <h2>{hunt.tag}</h2>
            {hunt.huntNumber && <p>Hunt #{hunt.huntNumber}</p>}
            <div className="tag-availability"><Check size={17} /><span><strong>{hunt.tagAvailability}</strong><small>{hunt.status}</small></span></div>
            <a className="tag-primary" href="https://idfg.idaho.gov/buy_online/"><ShoppingCart size={17} />License & tag options</a>
            <a className="tag-secondary" href={hunt.sourceUrl}>View official record <ExternalLink size={14} /></a>
          </aside>
        </section>

        <nav className="detail-anchor-nav" aria-label="On this page">
          <a href="#map-boundary">Map & boundary</a><a href="#rules">Rules</a><a href="#statistics">Statistics</a><a href="#access">Access</a><a href="#licenses">Licenses</a>
        </nav>

        <div className="detail-layout">
          <div className="detail-main-column">
            <section className="detail-section map-section" id="map-boundary">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Location</span><h2>Map & boundary</h2></div><a href="/"><Layers3 size={16} />Open Map Center</a></div>
              <div className="detail-map">
                <arcgis-map ref={mapRef} basemap="topo-vector" center={hunt.map.center} zoom={hunt.map.zoom} onarcgisViewReadyChange={handleMapReady}>
                  <arcgis-zoom slot="top-left" /><arcgis-locate slot="top-left" /><arcgis-scale-bar slot="bottom-left" unit="dual" />
                </arcgis-map>
                <span className="detail-map-label"><Crosshair size={15} />{hunt.areaLabel}</span>
              </div>
              <div className="boundary-copy"><div><strong>{hunt.areaLabel}</strong><span>{hunt.areaSize}</span></div><p>{hunt.boundary}</p></div>
              <div className="map-downloads"><a href={hunt.pdfUrl}><FileText size={16} />High-resolution PDF map</a><a href={hunt.sourceUrl}><Download size={16} />GIS & official downloads</a></div>
            </section>

            <section className="detail-section" id="rules">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Know before you go</span><h2>Season rules</h2></div></div>
              <div className="rules-grid"><div><small>Who may be taken</small><strong>{hunt.sex}</strong></div><div><small>Legal methods</small><strong>{hunt.method}</strong><p>{hunt.methodDetail}</p></div></div>
              <aside className="restriction-callout"><AlertTriangle size={21} /><div><strong>Restriction</strong><p>{hunt.warning}</p></div></aside>
              <p className="season-note"><strong>Season note:</strong> {hunt.note}</p>
            </section>

            <section className="detail-section" id="statistics">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Past performance</span><h2>Harvest statistics</h2></div><span className="data-note">Historical results do not predict future success</span></div>
              <StatTable columns={hunt.harvestColumns} rows={hunt.harvestRows} caption={`${hunt.areaLabel} harvest history`} />
              {hunt.odds && <div className="odds-block"><h3>Drawing odds</h3><div className="odds-grid">{hunt.odds.map((year) => <article key={year.year}><span>{year.year}</span><strong>{year.success}</strong><small>first-choice success</small><p>{year.permits} permits · {year.applicants} applicants</p></article>)}</div></div>}
            </section>

            <section className="detail-section" id="access">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Ownership & entry</span><h2>Land and access</h2></div></div>
              {hunt.ownership.length ? <div className="ownership-list">{hunt.ownership.map((item) => <div className="ownership-row" key={item.label}><div><strong>{item.label}</strong><span>{item.acres} acres</span></div><div className="ownership-track"><span style={{ width: `${item.value}%`, background: item.color }} /></div><b>{item.value}%</b></div>)}</div> : <aside className="empty-data"><Trees size={22} /><div><strong>Surface management detail unavailable</strong><p>The source Hunt Planner record does not currently provide agency acreage for this hunt area.</p></div></aside>}
              <div className="access-note"><MapIcon size={20} /><div><strong>Access Yes!</strong><p>{hunt.access}</p></div></div>
            </section>

            <section className="detail-section" id="licenses">
              <div className="detail-section-heading"><div><span className="detail-eyebrow">Before hunting</span><h2>Licenses, tags & permits</h2></div></div>
              <p className="license-intro">A valid hunting license is required for all hunting and trapping activities. Items marked * are optional.</p>
              <div className="license-columns"><div><h3>Idaho residents</h3><ul>{hunt.residentTags.map((tag) => <li key={tag}><Check size={15} />{tag}</li>)}</ul><a href="https://idfg.idaho.gov/licenses/fees-resident">Resident fees <ExternalLink size={13} /></a></div><div><h3>Nonresidents</h3><ul>{hunt.nonresidentTags.map((tag) => <li key={tag}><Check size={15} />{tag}</li>)}</ul><a href="https://idfg.idaho.gov/licenses/fees-nonresident">Nonresident fees <ExternalLink size={13} /></a></div></div>
            </section>
          </div>

          <aside className="detail-side-column">
            <section><span className="detail-eyebrow">Compare examples</span><h2>Result types</h2><a className={hunt.id === '82313' ? 'example-link active' : 'example-link'} href="/hunt/82313"><span><small>Controlled hunt</small><strong>Elk · Area 30A-1</strong></span><ChevronRight size={16} /></a><a className={hunt.id === '78813' ? 'example-link active' : 'example-link'} href="/hunt/78813"><span><small>General season</small><strong>Black bear · Unit 13</strong></span><ChevronRight size={16} /></a></section>
            <section className="official-record"><Accessibility size={20} /><h2>Planning aid</h2><p>This mockup organizes source data for trip planning. Regulations and official proclamations remain the legal record.</p><a href={hunt.sourceUrl}>Open current IDFG page <ExternalLink size={13} /></a></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default HuntDetailPage;
