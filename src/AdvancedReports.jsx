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

function BarChart({title, rows, metric='count', limit=12}) {
  const data = [...rows].sort((a,b)=>b[metric]-a[metric] || a.key.localeCompare(b.key,'en-GB')).slice(0,limit);
  const max = Math.max(1,...data.map(row=>number(row[metric])));
  return <section className="report-chart" aria-label={title}>
    <h3>{title}</h3>
    {data.length ? <div className="report-chart-list">{data.map(row=><div className="report-chart-item" key={row.key}>
      <span className="report-chart-label" title={row.key}>{displayKey(title==='Daily programmes'?'Daily outreach':title==='Programmes by type'?'By programme type':'Group',row.key)}</span>
      <div className="report-chart-track" role="img" aria-label={row.key+': '+number(row[metric])}>
        <div className="report-chart-bar" style={{width:(number(row[metric])/max*100)+'%'}}/>
      </div>
      <strong>{number(row[metric]).toLocaleString('en-GB')}</strong>
    </div>)}</div> : <p className="muted">No completed programmes in this selection.</p>}
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
  return <div className="report-v05">
    <div className="report-v05-heading">
      <div><h2>Dāmodara Outreach Report</h2><p className="muted">ISKCON Reading · {prettyDate(start)} – {prettyDate(end)} · Completed programmes only</p></div>
      {canManage && <button type="button" className="secondary" onClick={() => window.print()}>Print / Save PDF</button>}
    </div>
    <label className="report-v05-search">Search reports <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Reference, town, postcode, facilitator or type"/></label>
    <div className="report-summary">{[['Programmes',total.count],['Participants',total.participants],['Lamps',total.lamps],['Books',total.books]].map(([label,value])=><div key={label}><b>{value.toLocaleString('en-GB')}</b><span>{label}</span></div>)}</div>
    <div className="report-charts">
      <BarChart title="Daily programmes" rows={daily}/>
      {canManage && <>
        <BarChart title="Programmes by postcode" rows={areas}/>
        <BarChart title="Programmes by facilitator" rows={facilitators}/>
        <BarChart title="Programmes by type" rows={types}/>
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
