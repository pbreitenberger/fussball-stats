// Repo-Erkennung für die GitHub API. Auf GitHub Pages wird das automatisch aus der URL
// abgeleitet (owner.github.io/repo/...). Falls das mal nicht zuverlässig klappt (z.B. eigene
// Domain), hier einfach die Werte fest eintragen, z.B. REPO_OWNER = 'pbreitenberger'.
const REPO_OWNER = null;
const REPO_NAME = null;
const DATA_DIR = 'data';
const MANIFEST_FALLBACK = 'data/index.json';
const state = { trainings: [], rows: [], selectedTraining: 'ALL', selectedPlayer: 'ALL', charts: {}, mode: 'absolute' };

const metricAliases = {
  duration: ['duration','dauer'], distance: ['total distance','distanza totale','distanz total','gesamtdistanz'], maxSpeed: ['max speed','velocita massima','max. geschwindigkeit'], avgSpeed: ['average speed','velocita media'], accelerations: ['n. accelerations (> 2 m/s^2)','num. acceler','beschleunigungen'], decelerations: ['n. decelerations (> 2 m/s^2)','num. deceler'], metabolicPower: ['metabolic power','potenza met','met. power'], hsrCount: ['n. hsr','conteg. hsr'], sprintCount: ['n. sprint','conteg. sprint'], distance20_25: ['distanza 20-25 km/h','dist. 20-25km/h','distance 20-25'], distance25: ['distanza >25 km/h','dist. >25km/h','distance >25'], distance16_20: ['distanza 16-20 km/h','dist. 16-20km/h','distance 16-20'], distance11_16: ['distanza 11-16 km/h','dist. 11-16km/h','distance 11-16'], distance6_11: ['distanza 6-11 km/h','dist. 6-11km/h','distance 6-11'], distance0_6: ['distanza <6 km/h','dist. <6km/h','distance <6'], hmld: ['distanza p.met >25.5','dist. p.met >25.5','hmld']
};
const kpis = [
  { key:'distance', title:'Gesamtdistanz', unit:'m', icon:'👟', digits:1, aggregate:'sum' },
  { key:'distancePerMinute', title:'Distanz pro Minute', unit:'m/min', icon:'🏃', digits:1, aggregate:'weightedDpm' },
  { key:'hsrDistance', title:'HSR Distanz', unit:'m', icon:'⚡', digits:1, aggregate:'sum' },
  { key:'metabolicPower', title:'Metabolic Power', unit:'W/kg', icon:'❤', digits:2, aggregate:'avg' },
  { key:'maxSpeed', title:'Max. Geschwindigkeit', unit:'km/h', icon:'🏁', digits:2, aggregate:'max' },
  { key:'accelerations', title:'Beschleunigungen', unit:'n', icon:'↗', digits:1, aggregate:'sum' }
];

document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  try { const info = await loadTrainings(); render(); if (info.usedFallback) console.warn('GitHub API nicht nutzbar - data/index.json als Fallback verwendet.'); }
  catch (e) { document.getElementById('sessionMeta').textContent = e.message; console.error(e); }
});

function setupEvents(){
  document.getElementById('trainingSelect').addEventListener('change', e => { state.selectedTraining = e.target.value; syncPlayers(); render(); });
  document.getElementById('playerSelect').addEventListener('change', e => { state.selectedPlayer = e.target.value; render(); });
  document.getElementById('metricMode').addEventListener('change', e => { state.mode = e.target.value; render(); });
  document.getElementById('csvUpload').addEventListener('change', async e => {
    const files = [...e.target.files]; if(!files.length) return;
    const loaded = [];
    for (const file of files) loaded.push({ file: file.name, text: await file.text() });
    state.trainings = loaded.map(x => parseTraining(x.text, x.file));
    state.rows = state.trainings.flatMap(t => t.players.map(p => ({...p, trainingId:t.id, trainingTitle:t.title, trainingDate:t.date, trainingLabel:t.label, team:t.teamEntity})));
    state.selectedTraining = 'ALL'; state.selectedPlayer = 'ALL'; fillTrainingDropdown(); syncPlayers(); render();
  });
}

// Leitet Owner/Repo aus der aktuellen URL ab, z.B. https://pbreitenberger.github.io/fussball-stats/
// -> owner: pbreitenberger, repo: fussball-stats. Funktioniert auch für User-Root-Pages
// (owner.github.io ohne Unterordner) und lässt sich per REPO_OWNER/REPO_NAME übersteuern.
function detectRepoInfo(){
  const host = location.hostname;
  const hostParts = host.split('.');
  const owner = REPO_OWNER || (hostParts.length >= 3 && hostParts[1] === 'github' ? hostParts[0] : null);
  if(!owner) return null;
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const repo = REPO_NAME || pathSegments[0] || `${owner}.github.io`;
  return { owner, repo };
}

// Fragt die GitHub API nach allen Dateien im data/-Ordner. Läuft die Seite nicht auf
// GitHub Pages (z.B. lokal geöffnet) oder ist die API nicht erreichbar (Rate-Limit,
// offline), liefert die Funktion null und der Aufrufer greift auf data/index.json zurück.
async function discoverCsvFiles(){
  const info = detectRepoInfo();
  if(!info) return null;
  const url = `https://api.github.com/repos/${info.owner}/${info.repo}/contents/${DATA_DIR}`;
  let res;
  try { res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } }); }
  catch(e){ return null; }
  if(!res.ok) return null;
  const items = await res.json().catch(() => null);
  if(!Array.isArray(items)) return null;
  return items.filter(i => i.type === 'file' && /\.csv$/i.test(i.name)).map(i => i.name);
}

async function loadTrainings(){
  let files = await discoverCsvFiles();
  let usedFallback = false;
  let overrides = {};

  if(!files || !files.length){
    usedFallback = true;
    const manifest = await fetch(MANIFEST_FALLBACK,{cache:'no-store'}).then(r => r.ok ? r.json() : {trainings:[]}).catch(() => ({trainings:[]}));
    const items = manifest.trainings || [];
    files = items.map(i => i.file);
    items.forEach(i => overrides[i.file] = i);
  }

  if(!files.length) throw new Error('Keine Trainings gefunden. CSV-Dateien im Ordner data/ ablegen.');

  const loaded = [];
  for(const file of files){
    const text = await fetch(DATA_DIR + '/' + file,{cache:'no-store'}).then(r => { if(!r.ok) throw new Error('CSV konnte nicht geladen werden: ' + file); return r.text(); });
    loaded.push(parseTraining(text, file, overrides[file] || {}));
  }
  loaded.sort((a,b) => (a.date||'').localeCompare(b.date||'') || a.file.localeCompare(b.file));

  state.trainings = loaded;
  state.rows = loaded.flatMap(t => t.players.map(p => ({...p, trainingId:t.id, trainingTitle:t.title, trainingDate:t.date, trainingLabel:t.label, team:t.teamEntity})));
  fillTrainingDropdown(); syncPlayers();
  return { usedFallback, count: loaded.length };
}

function parseTraining(text, fileName, manifestItem={}){
  const matrix = parseCsv(text); const parsed = parseMatrixCsv(matrix);
  const date = manifestItem.date || parsed.meta.date || guessDate(fileName) || '';
  const title = manifestItem.title || parsed.meta.session || fileName.replace(/\.csv$/i,'');
  const id = fileName;
  const label = `${date ? date + ' - ' : ''}${title}`;
  return { id, file:fileName, date, title, label, meta:parsed.meta, players:parsed.players, teamEntity:parsed.team };
}

function parseCsv(text){
  const delimiter = detectDelimiter(text); const rows=[]; let row=[], cell='', inQuotes=false;
  for(let i=0;i<text.length;i++){ const ch=text[i], next=text[i+1];
    if(ch==='"'){ if(inQuotes && next==='"'){ cell+='"'; i++; } else inQuotes=!inQuotes; }
    else if(ch===delimiter && !inQuotes){ row.push(cell.trim()); cell=''; }
    else if((ch==='\n'||ch==='\r') && !inQuotes){ if(ch==='\r' && next==='\n') i++; row.push(cell.trim()); if(row.some(v=>v!=='')) rows.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  if(cell || row.length){ row.push(cell.trim()); if(row.some(v=>v!=='')) rows.push(row); }
  return rows;
}
function detectDelimiter(text){ const first=text.split(/\r?\n/).find(l=>l.trim())||''; return (first.match(/;/g)||[]).length > (first.match(/,/g)||[]).length ? ';' : ','; }
function parseMatrixCsv(rows){
  const meta={}; rows.forEach(r=>{ const k=clean(r[0]).replace(':','').toLowerCase(); if(k==='team') meta.team=r[1]||''; if(k==='session') meta.session=r[1]||''; if(k==='date') meta.date=r[1]||''; });
  let headerIndex=rows.findIndex(r=>r.some(c=>clean(c).toLowerCase()==='session average'));
  if(headerIndex<0) headerIndex=rows.findIndex(r=>clean(r[0])==='' && r.length>2);
  if(headerIndex<0) throw new Error('CSV-Format nicht erkannt. Erwartet wird eine Matrix mit Session average und Spieler-Spalten.');
  const headers=rows[headerIndex].map(clean); const metricRows=rows.slice(headerIndex+1).filter(r=>clean(r[0])!=='');
  const cols=headers.map((name,index)=>({name,index})).filter(c=>c.index>0 && c.name);
  const avgCol=cols.find(c=>c.name.toLowerCase()==='session average')||null; const playerCols=cols.filter(c=>c!==avgCol);
  const build=col=>{ const metrics={}; metricRows.forEach(r=>metrics[clean(r[0])]=clean(r[col.index])); return enrich({name:col.name,metrics}); };
  const players=playerCols.map(build); let team=avgCol ? build(avgCol) : aggregateRows(players, 'Ø Mannschaft'); team.name='Ø Mannschaft'; return {meta,players,team};
}

function enrich(entity){
  const distance=getValue(entity,'distance'); const duration=getDurationMinutes(entity); const hsrDistance=getValue(entity,'distance20_25')+getValue(entity,'distance25');
  entity.computed={ durationMinutes:duration, distance, distancePerMinute:safeDiv(distance,duration), hsrDistance, metabolicPower:getValue(entity,'metabolicPower'), maxSpeed:getValue(entity,'maxSpeed'), accelerations:getValue(entity,'accelerations'), decelerations:getValue(entity,'decelerations'), hsrCount:getValue(entity,'hsrCount'), sprintCount:getValue(entity,'sprintCount'), hmld:getValue(entity,'hmld'), zones:[getValue(entity,'distance0_6'),getValue(entity,'distance6_11'),getValue(entity,'distance11_16'),getValue(entity,'distance16_20'),getValue(entity,'distance20_25'),getValue(entity,'distance25')] };
  return entity;
}
function getValue(entity, aliasKey){ const wanted=(metricAliases[aliasKey]||[]).map(normalizeLabel); for(const [label,value] of Object.entries(entity.metrics || {})){ const n=normalizeLabel(label); if(wanted.some(w=>n.includes(w)||w.includes(n))) return parseNumber(value); } return 0; }
function getDurationMinutes(entity){ const wanted=metricAliases.duration.map(normalizeLabel); for(const [label,value] of Object.entries(entity.metrics || {})){ const n=normalizeLabel(label); if(wanted.some(w=>n.includes(w))) return parseDuration(value); } return 0; }
function aggregateRows(rows, name='Gesamt'){
  const c = {}; const sum = key => rows.reduce((a,r)=>a+(r.computed[key]||0),0); const avg = key => average(rows.map(r=>r.computed[key]||0));
  c.durationMinutes=sum('durationMinutes'); c.distance=sum('distance'); c.distancePerMinute=safeDiv(c.distance,c.durationMinutes); c.hsrDistance=sum('hsrDistance'); c.metabolicPower=avg('metabolicPower'); c.maxSpeed=Math.max(0,...rows.map(r=>r.computed.maxSpeed||0)); c.accelerations=sum('accelerations'); c.decelerations=sum('decelerations'); c.hsrCount=sum('hsrCount'); c.sprintCount=sum('sprintCount'); c.hmld=sum('hmld'); c.zones=[0,1,2,3,4,5].map(i=>rows.reduce((a,r)=>a+(r.computed.zones[i]||0),0));
  return { name, computed:c, metrics:{} };
}

function fillTrainingDropdown(){ const s=document.getElementById('trainingSelect'); s.innerHTML = `<option value="ALL">Alle Trainings</option>` + state.trainings.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`).join(''); s.value=state.selectedTraining; }
function syncPlayers(){ const s=document.getElementById('playerSelect'); const rows=filteredRows(false); const names=[...new Set(rows.map(r=>r.name))].sort((a,b)=>a.localeCompare(b,'de')); if(state.selectedPlayer!=='ALL' && !names.includes(state.selectedPlayer)) state.selectedPlayer='ALL'; s.innerHTML=`<option value="ALL">Alle Spieler</option>`+names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''); s.value=state.selectedPlayer; }
function filteredRows(includePlayer=true){ return state.rows.filter(r => (state.selectedTraining==='ALL'||r.trainingId===state.selectedTraining) && (!includePlayer||state.selectedPlayer==='ALL'||r.name===state.selectedPlayer)); }
function render(){ if(!state.rows.length) return; const rows=filteredRows(true); const scope=aggregateRows(rows, state.selectedPlayer==='ALL'?'Auswahl':state.selectedPlayer); const teamRows=filteredRows(false); const team=aggregateRows(teamRows, 'Ø / Gesamt Team'); const trainingText=state.selectedTraining==='ALL' ? `${state.trainings.length} Trainings` : state.trainings.find(t=>t.id===state.selectedTraining)?.label; document.getElementById('sessionMeta').textContent = `${trainingText} · ${state.selectedPlayer==='ALL'?'Alle Spieler':state.selectedPlayer}`; document.getElementById('tableSubtitle').textContent = `${rows.length} Datensätze im aktuellen Filter`; document.getElementById('modeAbsolute').classList.toggle('active',state.mode==='absolute'); document.getElementById('modeMinute').classList.toggle('active',state.mode==='perMinute'); renderKpis(scope, team, rows); renderTable(rows, scope, team); renderDistribution(rows, teamRows); renderTrend(); renderSpeedZones(scope); renderComparison(scope, team); }
function renderKpis(scope, team, rows){ document.getElementById('kpiGrid').innerHTML=kpis.map(k=>{ const v=scope.computed[k.key]||0; const t=team.computed[k.key]||0; const diff=percentDelta(v,t); const sd=std(rows.map(r=>r.computed[k.key]||0)); return `<article class="kpi card"><div class="kpi-title">${k.title}</div><div><span class="kpi-value">${format(v,k.digits)}</span><span class="kpi-unit">${k.unit}</span></div><div class="kpi-sub">Team ${format(t,k.digits)} · <span class="kpi-diff ${diff>=0?'pos':'neg'}">${diff>=0?'+':''}${format(diff,1)}%</span></div><div class="kpi-sub">σ ${format(sd,k.digits)} ${k.unit}</div><div class="kpi-icon">${k.icon}</div></article>`; }).join(''); }
function renderTable(rows, scope, team){ const perMin=state.mode==='perMinute'; document.getElementById('playersHead').innerHTML=`<tr><th>#</th><th>Spieler</th><th>Training</th><th>Dauer</th><th>Distanz ${perMin?'/ Min':'(m)'}</th><th>HSR ${perMin?'/ Min':'Dist. (m)'}</th><th>Max Speed</th><th>Met. Power</th><th>Beschl.</th><th>vs Ø Dist/Min</th></tr>`; const sorted=[...rows].sort((a,b)=>b.computed.distancePerMinute-a.computed.distancePerMinute); document.getElementById('playersTable').innerHTML=sorted.map((r,i)=>{ const delta=percentDelta(r.computed.distancePerMinute, team.computed.distancePerMinute); return `<tr class="${r.name===state.selectedPlayer?'selected':''}"><td>${i+1}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.trainingLabel)}</td><td>${formatDuration(r.computed.durationMinutes)}</td><td>${format(perMin?r.computed.distancePerMinute:r.computed.distance,1)}</td><td>${format(perMin?safeDiv(r.computed.hsrDistance,r.computed.durationMinutes):r.computed.hsrDistance,1)}</td><td>${format(r.computed.maxSpeed,2)}</td><td>${format(r.computed.metabolicPower,2)}</td><td>${format(r.computed.accelerations,1)}</td><td class="delta ${delta>=0?'pos':'neg'}">${delta>=0?'+':''}${format(delta,1)}%</td></tr>`; }).join(''); document.getElementById('playersFoot').innerHTML=`<tr><td></td><td>Aktuelle Auswahl</td><td>${rows.length} Datensätze</td><td>${formatDuration(scope.computed.durationMinutes)}</td><td>${format(perMin?scope.computed.distancePerMinute:scope.computed.distance,1)}</td><td>${format(perMin?safeDiv(scope.computed.hsrDistance,scope.computed.durationMinutes):scope.computed.hsrDistance,1)}</td><td>${format(scope.computed.maxSpeed,2)}</td><td>${format(scope.computed.metabolicPower,2)}</td><td>${format(scope.computed.accelerations,1)}</td><td>-</td></tr>`; }
function renderDistribution(rows, baseRows){ const values=baseRows.map(r=>r.computed.distancePerMinute).filter(v=>v>0); if(!values.length) return; const selectedValue=aggregateRows(rows).computed.distancePerMinute; const min=Math.floor(Math.min(...values)/10)*10; const max=Math.ceil(Math.max(...values)/10)*10; const step=Math.max(5,Math.ceil((max-min)/6)); const bins=[]; for(let start=min;start<=max;start+=step) bins.push({label:`${start}-${start+step}`,start,end:start+step,count:0}); values.forEach(v=>{ const b=bins.find(x=>v>=x.start&&v<x.end)||bins[bins.length-1]; b.count++; }); const selectedBin=bins.findIndex(b=>selectedValue>=b.start&&selectedValue<b.end); setChart('distributionChart','bar',{labels:bins.map(b=>b.label),datasets:[{label:'Anzahl Datensätze',data:bins.map(b=>b.count),backgroundColor:bins.map((_,i)=>i===selectedBin?'#58c96b':'rgba(148,163,184,.35)'),borderWidth:0}]},{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}); const sorted=[...baseRows].sort((a,b)=>b.computed.distancePerMinute-a.computed.distancePerMinute); const rank = sorted.filter(r=>r.computed.distancePerMinute>selectedValue).length + 1; const percentile=Math.round(((sorted.length-rank+1)/sorted.length)*100); document.getElementById('rankValue').textContent=`${rank} / ${sorted.length}`; document.getElementById('percentileValue').textContent=String(percentile); }
function renderTrend(){ const player=state.selectedPlayer; const labels=state.trainings.map(t=>t.date||t.title); const data=state.trainings.map(t=>{ const rows=state.rows.filter(r=>r.trainingId===t.id && (player==='ALL'||r.name===player)); return rows.length?aggregateRows(rows).computed.distancePerMinute:null; }); const teamData=state.trainings.map(t=>aggregateRows(state.rows.filter(r=>r.trainingId===t.id)).computed.distancePerMinute); setChart('trendChart','line',{labels,datasets:[{label:player==='ALL'?'Auswahl':'Spieler',data,borderColor:'#58c96b',backgroundColor:'rgba(88,201,107,.18)',fill:true,tension:.32,spanGaps:true},{label:'Team',data:teamData,borderColor:'rgba(229,237,248,.7)',borderDash:[6,5],backgroundColor:'transparent',tension:.32,spanGaps:true}]},{scales:{y:{beginAtZero:false,title:{display:true,text:'m/min'}}}}); }
function renderSpeedZones(scope){ setChart('speedZoneChart','bar',{labels:['<6','6-11','11-16','16-20','20-25','>25 km/h'],datasets:[{label:'Distanz',data:scope.computed.zones,backgroundColor:['#64748b','#7893b8','#5aa7ff','#58c96b','#f8c647','#ef6f6f']} ]},{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'Meter'}}}}); }
function renderComparison(scope, team){ const rows=[['Distanz pro Minute',scope.computed.distancePerMinute,team.computed.distancePerMinute,'m/min',1],['HSR Distanz pro Minute',safeDiv(scope.computed.hsrDistance,scope.computed.durationMinutes),safeDiv(team.computed.hsrDistance,team.computed.durationMinutes),'m/min',1],['Metabolic Power',scope.computed.metabolicPower,team.computed.metabolicPower,'W/kg',2],['Max. Geschwindigkeit',scope.computed.maxSpeed,team.computed.maxSpeed,'km/h',2],['Beschleunigungen pro Minute',safeDiv(scope.computed.accelerations,scope.computed.durationMinutes),safeDiv(team.computed.accelerations,team.computed.durationMinutes),'n/min',2]]; document.getElementById('compareTitle').textContent='Vergleich zur Mannschaft'; document.getElementById('comparisonRows').innerHTML=rows.map(([name,value,t,unit,d])=>{ const max=Math.max(value,t,1); const width=Math.min(100,value/max*100); const marker=Math.min(100,t/max*100); const delta=percentDelta(value,t); return `<div class="compare-row"><div class="compare-name">${name}</div><div class="compare-value">${format(value,d)} ${unit}</div><div class="bar"><div class="bar-fill" style="width:${width}%"></div><div class="team-marker" style="left:${marker}%"></div></div><div class="compare-team">${format(t,d)}</div><div class="delta ${delta>=0?'pos':'neg'}">${delta>=0?'+':''}${format(delta,1)}%</div></div>`; }).join(''); }
function setChart(id,type,data,options={}){ const base={responsive:true,maintainAspectRatio:false,animation:false,color:'#94a3b8',plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.12)'}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.12)'}}}}; const merged=deepMerge(base,options); if(state.charts[id]){state.charts[id].data=data;state.charts[id].options=merged;state.charts[id].update('none');return;} state.charts[id]=new Chart(document.getElementById(id),{type,data,options:merged}); }
function deepClone(v){ if(Array.isArray(v)) return v.map(deepClone); if(v&&typeof v==='object') { const out={}; for(const k in v) out[k]=deepClone(v[k]); return out; } return v; }
function deepMerge(t,s){ const out=deepClone(t); for(const[k,v]of Object.entries(s||{})){ if(v&&typeof v==='object'&&!Array.isArray(v)) out[k]=deepMerge(out[k]||{},v); else out[k]=v; } return out; }
function parseNumber(value){ if(typeof value==='number') return value; const s=String(value||'').replace(/\s/g,'').replace('%',''); if(!s)return 0; const normalized=s.includes(',')&&!s.includes('.')?s.replace(',','.'):s.replace(/,/g,''); const n=Number(normalized); return Number.isFinite(n)?n:0; }
function parseDuration(value){ const s=String(value||'').trim(); if(!s)return 0; if(s.includes(':')){ const p=s.split(':').map(Number); if(p.length===3)return p[0]*60+p[1]+p[2]/60; if(p.length===2)return p[0]+p[1]/60; } const n=parseNumber(s); return n>300?n/60:n; }
function normalizeLabel(s){return clean(s).toLowerCase().replace(/\s+/g,' ').replace(/²/g,'^2')} function clean(v){return String(v??'').trim()} function safeDiv(a,b){return b?a/b:0} function average(vals){const n=vals.filter(Number.isFinite);return n.length?n.reduce((a,b)=>a+b,0)/n.length:0} function std(vals){const n=vals.filter(Number.isFinite);const a=average(n);return n.length?Math.sqrt(average(n.map(v=>(v-a)**2))):0} function percentDelta(v,b){return b?((v-b)/b)*100:0} function format(v,d=1){return Number(v||0).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d})} function formatDuration(m){const h=Math.floor(m/60),mi=Math.floor(m%60),s=Math.round((m-Math.floor(m))*60);return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}`} function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))} function guessDate(name){const m=String(name).match(/\d{4}-\d{2}-\d{2}/);return m?m[0]:''}
