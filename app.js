const csvFile = 'data.csv';
let allRows = [];
let charts = {};

const numberFields = ['Tore', 'Assists', 'Spiele', 'Minuten'];
const filters = {
  season: document.getElementById('seasonFilter'),
  club: document.getElementById('clubFilter'),
  position: document.getElementById('positionFilter'),
  search: document.getElementById('playerSearch')
};

Papa.parse(csvFile, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: result => {
    allRows = result.data.map(row => {
      numberFields.forEach(field => row[field] = Number(row[field] || 0));
      row.Torbeteiligungen = row.Tore + row.Assists;
      row.MinutenProTor = row.Tore > 0 ? Math.round(row.Minuten / row.Tore) : null;
      return row;
    });
    initFilters();
    updateDashboard();
  },
  error: err => {
    console.error('CSV konnte nicht geladen werden:', err);
    alert('data.csv konnte nicht geladen werden. Bitte Dateiname und CSV-Header prüfen.');
  }
});

function initFilters() {
  fillSelect(filters.season, uniqueValues('Saison'));
  fillSelect(filters.club, uniqueValues('Verein'));
  fillSelect(filters.position, uniqueValues('Position'));

  Object.values(filters).forEach(el => el.addEventListener('input', updateDashboard));
  document.getElementById('resetFilters').addEventListener('click', () => {
    filters.season.value = 'Alle';
    filters.club.value = 'Alle';
    filters.position.value = 'Alle';
    filters.search.value = '';
    updateDashboard();
  });
}

function uniqueValues(field) {
  return [...new Set(allRows.map(r => r[field]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'de'));
}

function fillSelect(select, values) {
  select.innerHTML = ['Alle', ...values].map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function getFilteredRows() {
  const search = filters.search.value.trim().toLowerCase();
  return allRows.filter(row => {
    const seasonOk = filters.season.value === 'Alle' || row.Saison === filters.season.value;
    const clubOk = filters.club.value === 'Alle' || row.Verein === filters.club.value;
    const positionOk = filters.position.value === 'Alle' || row.Position === filters.position.value;
    const searchOk = !search || String(row.Spieler).toLowerCase().includes(search);
    return seasonOk && clubOk && positionOk && searchOk;
  });
}

function updateDashboard() {
  const rows = getFilteredRows();
  updateKpis(rows);
  updateTable(rows);
  updateCharts(rows);
}

function updateKpis(rows) {
  document.getElementById('kpiPlayers').textContent = rows.length;
  document.getElementById('kpiGoals').textContent = sum(rows, 'Tore');
  document.getElementById('kpiAssists').textContent = sum(rows, 'Assists');
  document.getElementById('kpiGames').textContent = sum(rows, 'Spiele');
}

function updateTable(rows) {
  const sorted = [...rows].sort((a, b) => b.Torbeteiligungen - a.Torbeteiligungen || b.Tore - a.Tore);
  document.getElementById('playersTable').innerHTML = sorted.map(row => `
    <tr>
      <td>${escapeHtml(row.Spieler)}</td>
      <td>${escapeHtml(row.Saison)}</td>
      <td>${escapeHtml(row.Verein)}</td>
      <td>${escapeHtml(row.Position)}</td>
      <td>${row.Tore}</td>
      <td>${row.Assists}</td>
      <td>${row.Spiele}</td>
      <td>${row.Minuten}</td>
      <td><strong>${row.Torbeteiligungen}</strong></td>
      <td>${row.MinutenProTor ?? '-'}</td>
    </tr>
  `).join('');
}

function updateCharts(rows) {
  const sortedGoals = [...rows].sort((a, b) => b.Tore - a.Tore).slice(0, 15);
  const sortedContribution = [...rows].sort((a, b) => b.Torbeteiligungen - a.Torbeteiligungen).slice(0, 15);
  const minutesGoal = [...rows].filter(r => r.MinutenProTor).sort((a, b) => a.MinutenProTor - b.MinutenProTor).slice(0, 15);

  renderChart('goalsChart', 'bar', {
    labels: sortedGoals.map(r => r.Spieler),
    datasets: [{ label: 'Tore', data: sortedGoals.map(r => r.Tore), backgroundColor: '#2563eb' }]
  });

  renderChart('contributionChart', 'bar', {
    labels: sortedContribution.map(r => r.Spieler),
    datasets: [
      { label: 'Tore', data: sortedContribution.map(r => r.Tore), backgroundColor: '#2563eb' },
      { label: 'Assists', data: sortedContribution.map(r => r.Assists), backgroundColor: '#16a34a' }
    ]
  }, { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } });

  renderChart('scatterChart', 'scatter', {
    datasets: [{
      label: 'Spieler',
      data: rows.map(r => ({ x: r.Tore, y: r.Assists, player: r.Spieler })),
      backgroundColor: '#f97316'
    }]
  }, {
    scales: { x: { title: { display: true, text: 'Tore' }, beginAtZero: true }, y: { title: { display: true, text: 'Assists' }, beginAtZero: true } },
    plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.player}: ${ctx.raw.x} Tore, ${ctx.raw.y} Assists` } } }
  });

  renderChart('minutesGoalChart', 'bar', {
    labels: minutesGoal.map(r => r.Spieler),
    datasets: [{ label: 'Minuten pro Tor', data: minutesGoal.map(r => r.MinutenProTor), backgroundColor: '#7c3aed' }]
  });
}

function renderChart(canvasId, type, data, extraOptions = {}) {
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: type === 'bar' ? { y: { beginAtZero: true } } : undefined,
      ...extraOptions
    }
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}
