import React from 'react';
import './advanced-reports.css';

const number = value => Number(value || 0);
const prettyDate = date => {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(date))) return date;
  return new Intl.DateTimeFormat('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
};
const names = {home:'Home',hall:'Hall',street:'High Street',other:'Other'};
const displayKey = (title,key) => title==='Daily outreach' ? prettyDate(key) : title==='By programme type' ? (names[key]||key) : key;
const district = postcode => {
  const text = String(postcode || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return text.split(' ')[0] || 'Not provided';
};
function aggregate(rows, keyOf) {
  const map = new Map();
  for (const item of rows) {
    const key = String(keyOf(item) || 'Unknown');
    if (!map.has(key)) map.set(key, { key, count: 0, participants: 0, lamps: 0, books: 0 });
    const entry = map.get(key);
    entry.count++;
    entry.participants += number(item.report.participants);
    entry.lamps += number(item.report.lamps);
    entry.books += number(item.report.books);
  }
  return Array.from(map.values()).sort((a,b)=>a.key.localeCompare(b.key, 'en-GB'));
}
function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function exportSummary(filename, rows) {
  const header = ['Group', 'Programmes', 'Participants', 'Lamps', 'Books'];
  const lines = [header, ...rows.map(x => [x.key, x.count, x.participants, x.lamps, x.books])];
  const csv = '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function SummaryTable({ title, rows, filename, download = true }) {
  return <section className="report-v05-block">
    <div className="report-v05-heading"><h3>{title}</h3>{download && <button className="secondary" type="button" onClick={() => exportSummary(filename, rows)}>Export CSV</button>}</div>
    {rows.length ? <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{title === 'Daily outreach' ? 'Date' : 'Group'}</th><th>Programmes</th><th>Participants</th><th>Lamps</th><th>Books</th></tr></thead>
      <tbody>{rows.map(x => <tr key={x.key}><td>{displayKey(title,x.key)}</td><td>{x.count}</td><td>{x.participants}</td><td>{x.lamps}</td><td>{x.books}</td></tr>)}</tbody>
    </table></div> : <p className="muted">No completed reports match the selected filters.</p>}
  </section>;
}

const chartThemes = {
  'Daily programmes': { icon:'📅', className:'theme-daily', label:'Daily programmes' },
  'Programmes by postcode': { icon:'📍', className:'theme-postcode', label:'Postcode outreach' },
  'Programmes by facilitator': { icon:'🤝', className:'theme-facilitator', label:'Facilitator contributions' },
  'Programmes by type': { icon:'🪔', className:'theme-type', label:'Programme types' }
};
function BarChart({title,rows,metric='count',limit=12}){
  const meta=chartThemes[title]||{icon:'📊',className:'theme-daily',label:title};
  const data=[...rows].sort((a,b)=>b[metric]-a[metric]||a.key.localeCompare(b.key,'en-GB')).slice(0,limit);
  const max=Math.max(1,...data.map(row=>number(row[metric])));
  return <section className={'report-chart '+meta.className} aria-label={title}>
    <h3><span className="report-chart-icon" aria-hidden="true">{meta.icon}</span>{meta.label}</h3>
    {data.length?<div className="report-chart-list">{data.map((row,i)=><div className="report-chart-item" key={row.key}>
      <span className="report-chart-label" title={row.key}>{displayKey(title==='Daily programmes'?'Daily outreach':title==='Programmes by type'?'By programme type':'Group',row.key)}</span>
      <div className="report-chart-track" role="img" aria-label={row.key+': '+number(row[metric])+' programmes'}>
        <div className="report-chart-bar" style={{width:(number(row[metric])/max*100)+'%'}}/>
      </div>
      <strong>{number(row[metric]).toLocaleString('en-GB')}</strong>
    </div>)}</div>:<p className="muted">No completed programmes in this selection.</p>}
  </section>;
}
const typePalette=['#9959A8','#D99A39','#277F88','#A95A40','#658047'];
function TypeDonut({rows}){
  const ordered=[...rows].sort((a,b)=>b.count-a.count);
  const total=ordered.reduce((sum,row)=>sum+row.count,0);
  let acc=0;
  const stops=ordered.map((item,i)=>{
    const start=acc;
    acc+=item.count/Math.max(1,total)*100;
    return typePalette[i%typePalette.length]+' '+start+'% '+acc+'%';
  });
  return <section className="report-chart theme-type report-donut-card" aria-label="Programme type distribution">
    <h3><span className="report-chart-icon" aria-hidden="true">🏠</span>Programme type mix</h3>
    <div className="report-donut-layout">
      <div className="report-donut" role="img" aria-label={total+' completed programmes by type'} style={{background:total?'conic-gradient('+stops.join(',')+')':'#E6DAEB'}}>
        <div className="report-donut-centre"><strong>{total.toLocaleString('en-GB')}</strong><small>Total</small></div>
      </div>
      <div className="report-donut-legend">{ordered.map((item,i)=><div key={item.key} className="report-donut-legend-row">
        <span className="report-donut-dot" style={{background:typePalette[i%typePalette.length]}}/>
        <span>{names[item.key]||item.key}</span><strong>{item.count}</strong>
      </div>)}{!ordered.length&&<p className="muted">No completed programmes yet.</p>}</div>
    </div>
  </section>;
}

export default function AdvancedReports({ rows, canManage, start, end }) {
  const [search, setSearch] = React.useState('');
  const filtered = rows.filter(x => [x.registration.reference,x.registration.city,x.registration.postcode,x.facilitator,x.registration.program_type].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const daily = aggregate(filtered, x => x.program.scheduled_date);
  const areas = aggregate(filtered, x => district(x.registration.postcode));
  const facilitators = aggregate(filtered, x => x.facilitator || 'Unassigned');
  const types = aggregate(filtered, x => x.registration.program_type);
  const total = aggregate(filtered, () => 'Campaign total')[0] || { count: 0, participants: 0, lamps: 0, books: 0 };
  return <div className="report-v05" id="damodara-print-report">
    <div className="report-v05-heading">
      <div><div className="report-print-identity">ISKCON READING · UNITED KINGDOM</div><h2>Dāmodara Outreach Report 2026</h2><p className="muted">ISKCON Reading · {prettyDate(start)} – {prettyDate(end)} · Completed programmes only</p><p className="report-generated">Generated {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date())} (UK time)</p></div>
      {canManage && <button type="button" className="secondary" onClick={() => window.print()}>Print / Save PDF</button>}
    </div>
    <label className="report-v05-search">Search reports <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Reference, town, postcode, facilitator or type"/></label>
    <div className="report-impact"><div className="report-impact-intro"><span className="report-impact-eyebrow">KĀRTIK OUTREACH · IMPACT SNAPSHOT</span><h3>Every lamp tells a story</h3><p>Outreach totals from completed programme reports in the selected period.</p></div><div className="report-summary">{[['Programmes',total.count,'📅','impact-programmes'],['Participants',total.participants,'👥','impact-participants'],['Lamps offered',total.lamps,'🪔','impact-lamps'],['Books distributed',total.books,'📚','impact-books']].map(([label,value,icon,theme])=><div key={label} className={'report-summary-card '+theme}><span className="impact-icon" aria-hidden="true">{icon}</span><b>{value.toLocaleString('en-GB')}</b><span>{label}</span></div>)}</div></div>
    <div className="report-charts">
      <BarChart title="Daily programmes" rows={daily}/>
      {canManage && <>
        <BarChart title="Programmes by postcode" rows={areas}/>
        <BarChart title="Programmes by facilitator" rows={facilitators}/>
        <TypeDonut rows={types}/>
      </>}
    </div>
    <SummaryTable title="Daily outreach" rows={daily} filename="damodara-daily-report.csv" download={canManage}/>
    {canManage && <>
      <SummaryTable title="By postcode district" rows={areas} filename="damodara-postcode-report.csv"/>
      <SummaryTable title="By facilitator" rows={facilitators} filename="damodara-facilitator-report.csv"/>
      <SummaryTable title="By programme type" rows={types} filename="damodara-programme-types.csv"/>
    </>}
    <p className="muted report-v05-note">Reporting includes submitted completion reports visible to this user. Exclude test programmes before preparing an official ISKCON Reading summary.</p>
  </div>;
}
