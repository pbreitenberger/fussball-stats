const DEFAULT_CSV = 'data.csv';
const state = { meta: {}, players: [], team: null, selected: null, charts: {}, mode: 'absolute' };

const metricAliases = {
  duration: ['duration', 'dauer'],
  distance: ['total distance', 'distanza totale', 'distanz total', 'gesamtdistanz'],
  maxSpeed: ['max speed', 'velocita massima', 'velocity max', 'max. geschwindigkeit'],
  avgSpeed: ['average speed', 'velocita media'],
  accelerations: ['n. accelerations (> 2 m/s^2)', 'num. acceler', 'beschleunigungen'],
  decelerations: ['n. decelerations (> 2 m/s^2)', 'num. deceler'],
  metabolicPower: ['metabolic power', 'potenza met', 'met. power'],
  hsrCount: ['n. hsr', 'conteg. hsr'],
  sprintCount: ['n. sprint', 'conteg. sprint'],
  distance20_25: ['distanza 20-25 km/h', 'dist. 20-25km/h', 'distance 20-25'],
  distance25: ['distanza >25 km/h', 'dist. >25km/h', 'distance >25'],
  distance16_20: ['distanza 16-20 km/h', 'dist. 16-20km/h', 'distance 16-20'],
  distance11_16: ['distanza 11-16 km/h', 'dist. 11-16km/h', 'distance 11-16'],
  distance6_11: ['distanza 6-11 km/h', 'dist. 6-11km/h', 'distance 6-11'],
  distance0_6: ['distanza <6 km/h', 'dist. <6km/h', 'distance <6'],
  hmld: ['distanza p.met >25.5', 'dist. p.met >25.5', 'hmld']
};

const kpis = [
  { key: 'distance', title: 'Gesamtdistanz', unit: 'm', icon: '👟', digits: 1 },
  { key: 'distancePerMinute', title: 'Distanz pro Minute', unit: 'm/min', icon: '🏃', digits: 1 },
  { key: 'hsrDistance', title: 'HSR Distanz', unit: 'm', icon: '⚡', digits: 1 },
  { key: 'metabolicPower', title: 'Metabolic Power', unit: 'W/kg', icon: '❤', digits: 2 },
  { key: 'maxSpeed', title: 'Max. Geschwindigkeit', unit: 'km/h', icon: '🏁', digits: 2 },
  { key: 'accelerations', title: 'Beschleunigungen', unit: 'n', icon: '↗', digits: 1 }
];

window.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  try {
    const text = await fetch(DEFAULT_CSV, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('data.csv konnte nicht geladen werden');
      return r.text();
    });
    loadCsvText(text);
  } catch (error) {
    document.getElementById('sessionMeta').textContent = error.message;
  }
});

function setupEvents() {
  document.getElementById('playerSelect').addEventListener('change', e => {
    state.selected = e.target.value;
    render();
  });
  document.getElementById('metricMode').addEventListener('change', e => {
    state.mode = e.target.value;
    render();
  });
  document.getElementById('csvUpload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadCsvText(String(reader.result));
    reader.readAsText(file, 'utf-8');
  });
}

function loadCsvText(text) {
  const rows = parseCsv(text);
  const parsed = parseMatrixCsv(rows);
  state.meta = parsed.meta;
  state.players = parsed.players;
  state.team = parsed.team;
  state.selected = state.players[0]?.name || null;
  fillPlayerDropdown();
  render();
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      row.push(cell.trim()); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(v => v !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

function detectDelimiter(text) {
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const comma = (first.match(/,/g) || []).length;
  const semi = (first.match(/;/g) || []).length;
  return semi > comma ? ';' : ',';
}

function parseMatrixCsv(rows) {
  const meta = {};
  rows.forEach(r => {
    const k = clean(r[0]).replace(':', '').toLowerCase();
    if (k === 'team') meta.team = r[1] || '';
    if (k === 'session') meta.session = r[1] || '';
    if (k === 'date') meta.date = r[1] || '';
  });

  let headerIndex = rows.findIndex(r => r.some(c => clean(c).toLowerCase() === 'session average'));
  if (headerIndex < 0) headerIndex = rows.findIndex(r => clean(r[0]) === '' && r.length > 2);
  if (headerIndex < 0) throw new Error('CSV-Format nicht erkannt. Erwartet wird eine Matrix mit Session average und Spieler-Spalten.');

  const headers = rows[headerIndex].map(clean);
  const metricRows = rows.slice(headerIndex + 1).filter(r => clean(r[0]) !== '');
  const columns = headers.map((name, index) => ({ name, index })).filter(c => c.index > 0 && c.name);
  const avgColumn = columns.find(c => c.name.toLowerCase() === 'session average') || null;
  const playerColumns = columns.filter(c => c !== avgColumn);

  const buildEntity = col => {
    const metrics = {};
    metricRows.forEach(r => metrics[clean(r[0])] = clean(r[col.index]));
    return enrich({ name: col.name, metrics });
  };

  const players = playerColumns.map(buildEntity);
  let team = avgColumn ? buildEntity(avgColumn) : buildTeamAverage(players);
  team.name = 'Ø Mannschaft';
  return { meta, players, team };
}

function enrich(entity) {
  const distance = getValue(entity, 'distance');
  const duration = getDurationMinutes(entity);
  const dpm = duration ? distance / duration : 0;
  const hsrDistance = getValue(entity, 'distance20_25') + getValue(entity, 'distance25');
  entity.computed = {
    durationMinutes: duration,
    distance,
    distancePerMinute: dpm,
    hsrDistance,
    metabolicPower: getValue(entity, 'metabolicPower'),
    maxSpeed: getValue(entity, 'maxSpeed'),
    accelerations: getValue(entity, 'accelerations'),
    decelerations: getValue(entity, 'decelerations'),
    hsrCount: getValue(entity, 'hsrCount'),
    sprintCount: getValue(entity, 'sprintCount'),
    hmld: getValue(entity, 'hmld'),
    zones: [
      getValue(entity, 'distance0_6'), getValue(entity, 'distance6_11'), getValue(entity, 'distance11_16'),
      getValue(entity, 'distance16_20'), getValue(entity, 'distance20_25'), getValue(entity, 'distance25')
    ]
  };
  return entity;
}

function buildTeamAverage(players) {
  const metrics = {};
  Object.keys(metricAliases).forEach(k => metrics[k] = average(players.map(p => p.computed?.[k] || 0)));
  return enrich({ name: 'Ø Mannschaft', metrics });
}

function getValue(entity, aliasKey) {
  const aliases = metricAliases[aliasKey] || [];
  const wanted = aliases.map(normalizeLabel);
  for (const [label, value] of Object.entries(entity.metrics)) {
    const normalized = normalizeLabel(label);
    if (wanted.some(w => normalized.includes(w) || w.includes(normalized))) return parseNumber(value);
  }
  return 0;
}

function getDurationMinutes(entity) {
  const aliases = metricAliases.duration.map(normalizeLabel);
  for (const [label, value] of Object.entries(entity.metrics)) {
    const normalized = normalizeLabel(label);
    if (aliases.some(w => normalized.includes(w))) return parseDuration(value);
  }
  return 0;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '').replace(/\s/g, '').replace('%', '');
  if (!s) return 0;
  const normalized = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseDuration(value) {
  const s = String(value || '').trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
  }
  const n = parseNumber(s);
  return n > 300 ? n / 60 : n;
}

function normalizeLabel(s) { return clean(s).toLowerCase().replace(/\s+/g, ' ').replace(/²/g, '^2'); }
function clean(v) { return String(v ?? '').trim(); }
function average(values) { const nums = values.filter(Number.isFinite); return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : 0; }
function std(values) { const nums = values.filter(Number.isFinite); const avg = average(nums); return nums.length ? Math.sqrt(average(nums.map(v => (v - avg) ** 2))) : 0; }

function fillPlayerDropdown() {
  const select = document.getElementById('playerSelect');
  select.innerHTML = state.players.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
  select.value = state.selected;
}

function render() {
  if (!state.players.length) return;
  const selected = getSelectedPlayer();
  const meta = [state.meta.team, state.meta.session, state.meta.date].filter(Boolean).join(' · ');
  document.getElementById('sessionMeta').textContent = meta || 'Trainingseinheit';
  document.getElementById('tableSubtitle').textContent = `${state.players.length} Spieler im aktuellen CSV-File`;
  document.getElementById('modeAbsolute').classList.toggle('active', state.mode === 'absolute');
  document.getElementById('modeMinute').classList.toggle('active', state.mode === 'perMinute');
  renderKpis(selected);
  renderTable(selected);
  renderDistribution(selected);
  renderSpeedZones(selected);
  renderComparison(selected);
}

function getSelectedPlayer() { return state.players.find(p => p.name === state.selected) || state.players[0]; }

function renderKpis(player) {
  const html = kpis.map(kpi => {
    const value = player.computed[kpi.key] || 0;
    const team = state.team.computed[kpi.key] || 0;
    const deviation = team ? ((value - team) / team) * 100 : 0;
    const sd = std(state.players.map(p => p.computed[kpi.key] || 0));
    return `<article class="kpi card">
      <div class="kpi-title">${kpi.title} (Ø)</div>
      <div><span class="kpi-value">${format(value, kpi.digits)}</span><span class="kpi-unit">${kpi.unit}</span></div>
      <div class="kpi-sub">± ${format(sd, kpi.digits)} ${kpi.unit} · <span class="kpi-diff ${deviation >= 0 ? 'pos' : 'neg'}">${deviation >= 0 ? '+' : ''}${format(deviation, 1)}%</span></div>
      <div class="kpi-icon">${kpi.icon}</div>
    </article>`;
  }).join('');
  document.getElementById('kpiGrid').innerHTML = html;
}

function renderTable(selected) {
  const perMin = state.mode === 'perMinute';
  document.getElementById('playersHead').innerHTML = `<tr>
    <th>#</th><th>Spieler</th><th>Dauer</th><th>Distanz ${perMin ? '/ Min' : '(m)'}</th><th>HSR ${perMin ? '/ Min' : 'Dist. (m)'}</th><th>Max. Speed</th><th>Met. Power</th><th>Beschl.</th><th>vs. Ø Dist/Min</th>
  </tr>`;
  const sorted = [...state.players].sort((a,b) => b.computed.distancePerMinute - a.computed.distancePerMinute);
  document.getElementById('playersTable').innerHTML = sorted.map((p, i) => {
    const delta = percentDelta(p.computed.distancePerMinute, state.team.computed.distancePerMinute);
    return `<tr class="${p.name === selected.name ? 'selected' : ''}">
      <td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td>${formatDuration(p.computed.durationMinutes)}</td>
      <td>${format(perMin ? p.computed.distancePerMinute : p.computed.distance, 1)}</td>
      <td>${format(perMin ? safeDiv(p.computed.hsrDistance, p.computed.durationMinutes) : p.computed.hsrDistance, 1)}</td>
      <td>${format(p.computed.maxSpeed, 2)}</td><td>${format(p.computed.metabolicPower, 2)}</td><td>${format(p.computed.accelerations, 1)}</td>
      <td class="delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${format(delta, 1)}%</td>
    </tr>`;
  }).join('');
  const t = state.team.computed;
  document.getElementById('playersFoot').innerHTML = `<tr><td></td><td>Ø Mannschaft</td><td>${formatDuration(t.durationMinutes)}</td><td>${format(perMin ? t.distancePerMinute : t.distance, 1)}</td><td>${format(perMin ? safeDiv(t.hsrDistance, t.durationMinutes) : t.hsrDistance, 1)}</td><td>${format(t.maxSpeed, 2)}</td><td>${format(t.metabolicPower, 2)}</td><td>${format(t.accelerations, 1)}</td><td>-</td></tr>`;
}

function renderDistribution(selected) {
  const values = state.players.map(p => p.computed.distancePerMinute).filter(v => v > 0);
  const min = Math.floor(Math.min(...values) / 10) * 10;
  const max = Math.ceil(Math.max(...values) / 10) * 10;
  const step = Math.max(5, Math.ceil((max - min) / 6));
  const bins = [];
  for (let start = min; start <= max; start += step) bins.push({ label: `${start}-${start + step}`, start, end: start + step, count: 0 });
  values.forEach(v => { const bin = bins.find(b => v >= b.start && v < b.end) || bins[bins.length - 1]; bin.count++; });
  const selectedBin = bins.findIndex(b => selected.computed.distancePerMinute >= b.start && selected.computed.distancePerMinute < b.end);
  const colors = bins.map((_, i) => i === selectedBin ? '#58c96b' : 'rgba(148,163,184,.35)');
  setChart('distributionChart', 'bar', { labels: bins.map(b => b.label), datasets: [{ label: 'Anzahl Spieler', data: bins.map(b => b.count), backgroundColor: colors, borderWidth: 0 }] }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } });
  const sorted = [...state.players].sort((a,b) => b.computed.distancePerMinute - a.computed.distancePerMinute);
  const rank = sorted.findIndex(p => p.name === selected.name) + 1;
  const percentile = Math.round(((state.players.length - rank + 1) / state.players.length) * 100);
  document.getElementById('rankValue').textContent = `${rank} / ${state.players.length}`;
  document.getElementById('percentileValue').textContent = `${percentile}`;
}

function renderSpeedZones(selected) {
  setChart('speedZoneChart', 'bar', {
    labels: ['<6', '6-11', '11-16', '16-20', '20-25', '>25 km/h'],
    datasets: [{ label: selected.name, data: selected.computed.zones, backgroundColor: ['#64748b','#7893b8','#5aa7ff','#58c96b','#f8c647','#ef6f6f'] }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Meter' } } } });
}

function renderComparison(selected) {
  const rows = [
    ['Distanz pro Minute', selected.computed.distancePerMinute, state.team.computed.distancePerMinute, 'm/min', 1],
    ['HSR Distanz pro Minute', safeDiv(selected.computed.hsrDistance, selected.computed.durationMinutes), safeDiv(state.team.computed.hsrDistance, state.team.computed.durationMinutes), 'm/min', 1],
    ['Metabolic Power', selected.computed.metabolicPower, state.team.computed.metabolicPower, 'W/kg', 2],
    ['Max. Geschwindigkeit', selected.computed.maxSpeed, state.team.computed.maxSpeed, 'km/h', 2],
    ['Beschleunigungen pro Minute', safeDiv(selected.computed.accelerations, selected.computed.durationMinutes), safeDiv(state.team.computed.accelerations, state.team.computed.durationMinutes), 'n/min', 2]
  ];
  document.getElementById('compareTitle').textContent = `Vergleich zur Mannschaft (${selected.name})`;
  document.getElementById('comparisonRows').innerHTML = rows.map(([name, value, team, unit, digits]) => {
    const max = Math.max(value, team, 1);
    const width = Math.min(100, (value / max) * 100);
    const marker = Math.min(100, (team / max) * 100);
    const delta = percentDelta(value, team);
    return `<div class="compare-row">
      <div class="compare-name">${name}</div><div class="compare-value">${format(value, digits)} ${unit}</div>
      <div class="bar"><div class="bar-fill" style="width:${width}%"></div><div class="team-marker" style="left:${marker}%"></div></div>
      <div class="compare-team">${format(team, digits)}</div><div class="delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '+' : ''}${format(delta, 1)}%</div>
    </div>`;
  }).join('');
}

function setChart(id, type, data, options = {}) {
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    color: '#94a3b8',
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.12)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.12)' } }
    }
  };
  const merged = deepMerge(baseOptions, options);
  if (state.charts[id]) {
    state.charts[id].data = data;
    state.charts[id].options = merged;
    state.charts[id].update('none');
    return;
  }
  state.charts[id] = new Chart(document.getElementById(id), { type, data, options: merged });
}

function deepMerge(target, source) {
  const out = structuredClone(target);
  for (const [k,v] of Object.entries(source || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(out[k] || {}, v);
    else out[k] = v;
  }
  return out;
}

function safeDiv(a,b) { return b ? a / b : 0; }
function percentDelta(value, base) { return base ? ((value - base) / base) * 100 : 0; }
function format(value, digits = 1) { return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function formatDuration(minutes) { const h = Math.floor(minutes / 60); const m = Math.floor(minutes % 60); const s = Math.round((minutes - Math.floor(minutes)) * 60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
