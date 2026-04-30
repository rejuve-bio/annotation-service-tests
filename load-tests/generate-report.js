#!/usr/bin/env node
/**
 * Generates a self-contained HTML report from an Artillery JSON result file.
 * Usage: node generate-report.js results/report-<timestamp>.json
 */

const fs   = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) {
    console.error('Usage: node generate-report.js <path-to-artillery-json>');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const agg  = data.aggregate;
const c    = agg.counters  || {};
const s    = agg.summaries || {};

const created   = c['vusers.created']    || 0;
const completed = c['vusers.completed']  || 0;
const failed    = c['vusers.failed']     || 0;
const req200    = c['http.codes.200']    || 0;
const req500    = c['http.codes.500']    || 0;
const totalReq  = c['http.requests']     || 0;
const timeouts  = c['errors.Error: timeout'] || 0;
const successRate = created > 0 ? ((completed / created) * 100).toFixed(1) : 0;

const startMs = agg.firstMetricAt;
const endMs   = agg.lastMetricAt;
const durationSec = ((endMs - startMs) / 1000).toFixed(0);
const startStr = new Date(startMs).toLocaleString();

function ms(v) {
    if (v === undefined || v === null) return '—';
    return v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
}

function statRow(label, stat) {
    if (!stat) return '';
    return `
    <tr>
      <td>${label}</td>
      <td>${ms(stat.min)}</td>
      <td>${ms(stat.median)}</td>
      <td>${ms(stat.p75)}</td>
      <td>${ms(stat.p90)}</td>
      <td>${ms(stat.p95)}</td>
      <td>${ms(stat.p99)}</td>
      <td>${ms(stat.max)}</td>
      <td>${stat.count}</td>
    </tr>`;
}

// Separate latency_* entries from other summaries
const latencyKeys = Object.keys(s).filter(k => k.startsWith('latency_'));
const otherKeys   = Object.keys(s).filter(k => !k.startsWith('latency_'));

// Build bar chart data for per-query median latency (in seconds)
const chartEntries = latencyKeys.map(k => ({
    label: k.replace('latency_', ''),
    median: s[k].median / 1000,
    p95:    s[k].p95    / 1000,
    count:  s[k].count
})).sort((a, b) => a.median - b.median);

const maxVal = Math.max(...chartEntries.map(e => e.p95), 1);

function barRow(e) {
    const medPct = ((e.median / maxVal) * 100).toFixed(1);
    const p95Pct = ((e.p95    / maxVal) * 100).toFixed(1);
    return `
    <tr>
      <td class="bar-label">${e.label}</td>
      <td class="bar-cell">
        <div class="bar-track">
          <div class="bar-p95"  style="width:${p95Pct}%"></div>
          <div class="bar-med"  style="width:${medPct}%"></div>
        </div>
      </td>
      <td class="bar-num">${e.median.toFixed(1)} s</td>
      <td class="bar-num">${e.p95.toFixed(1)} s</td>
      <td class="bar-num">${e.count}</td>
    </tr>`;
}

const statusColor = Number(successRate) >= 80 ? '#16a34a' : Number(successRate) >= 50 ? '#d97706' : '#dc2626';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Artillery Load Test Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .meta { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
  h2 { font-size: 1rem; font-weight: 600; margin: 2rem 0 0.75rem; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 0.5rem; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
  .card .val { font-size: 1.75rem; font-weight: 700; }
  .card .lbl { font-size: 0.75rem; color: #64748b; margin-top: 0.2rem; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 0.5rem; font-size: 0.85rem; }
  th { background: #f1f5f9; text-align: left; padding: 0.6rem 0.75rem; font-weight: 600; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 0.55rem 0.75rem; border-top: 1px solid #f1f5f9; vertical-align: middle; }
  tr:hover td { background: #f8fafc; }
  .bar-label { width: 220px; font-size: 0.8rem; }
  .bar-cell { width: 100%; }
  .bar-track { position: relative; height: 18px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .bar-p95 { position: absolute; top: 0; left: 0; height: 100%; background: #bfdbfe; border-radius: 4px; }
  .bar-med { position: absolute; top: 0; left: 0; height: 100%; background: #3b82f6; border-radius: 4px; }
  .bar-num { white-space: nowrap; font-size: 0.8rem; color: #334155; padding-left: 0.5rem; }
  .legend { display: flex; gap: 1rem; font-size: 0.75rem; color: #64748b; margin-bottom: 0.75rem; }
  .legend span { display: flex; align-items: center; gap: 0.3rem; }
  .dot { width: 10px; height: 10px; border-radius: 2px; }
</style>
</head>
<body>
<h1>Artillery Load Test Report</h1>
<p class="meta">Started: ${startStr} &nbsp;·&nbsp; Duration: ${durationSec}s &nbsp;·&nbsp; Source: ${path.basename(inputFile)}</p>

<h2>Summary</h2>
<div class="cards">
  <div class="card"><div class="val">${created}</div><div class="lbl">Virtual Users</div></div>
  <div class="card"><div class="val" style="color:${statusColor}">${successRate}%</div><div class="lbl">Success Rate</div></div>
  <div class="card"><div class="val">${completed}</div><div class="lbl">Completed</div></div>
  <div class="card"><div class="val" style="color:#dc2626">${failed}</div><div class="lbl">Failed</div></div>
  <div class="card"><div class="val">${timeouts}</div><div class="lbl">Timeouts</div></div>
  <div class="card"><div class="val">${totalReq}</div><div class="lbl">HTTP Requests</div></div>
  <div class="card"><div class="val" style="color:#16a34a">${req200}</div><div class="lbl">HTTP 200</div></div>
  <div class="card"><div class="val" style="color:#dc2626">${req500}</div><div class="lbl">HTTP 500</div></div>
</div>

<h2>Per-Query Latency (end-to-end, completed only)</h2>
<div class="legend">
  <span><span class="dot" style="background:#3b82f6"></span>Median</span>
  <span><span class="dot" style="background:#bfdbfe"></span>p95</span>
</div>
<table>
  <thead><tr><th>Query</th><th>Chart</th><th>Median</th><th>p95</th><th>Count</th></tr></thead>
  <tbody>${chartEntries.map(barRow).join('')}</tbody>
</table>

<h2>Response Time Breakdown</h2>
<table>
  <thead><tr><th>Metric</th><th>Min</th><th>Median</th><th>p75</th><th>p90</th><th>p95</th><th>p99</th><th>Max</th><th>Count</th></tr></thead>
  <tbody>${otherKeys.map(k => statRow(k.replace(/\./g, ' ').replace(/_/g, ' '), s[k])).join('')}</tbody>
</table>

</body>
</html>`;

const outFile = inputFile.replace(/\.json$/, '.html');
fs.writeFileSync(outFile, html);
console.log(`Report written to: ${outFile}`);
