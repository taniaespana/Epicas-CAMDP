/* =========================================================
   CAMDP Dashboard — Interactive Charts & Filtering
   Click any chart segment to filter the epic table.
   ========================================================= */

const WM = { blue: '#0053e2', spark: '#ffc220', green: '#2a8703', red: '#ea1100' };
const PALETTE = [
  '#0053e2','#2a8703','#ea1100','#ffc220','#6366f1','#06b6d4',
  '#8b5cf6','#f97316','#ec4899','#14b8a6','#a855f7','#0891b2',
];

// ---------------------- State ----------------------
let activeFilter = { field: null, value: null };

// ---------------------- DOM helpers ----------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function updateVisibleCount() {
  const visible = $$('#epicTable tbody tr:not([style*="display: none"])').length;
  $('#visibleCount').textContent = visible;
}

function showFilterBanner(label) {
  $('#filterBanner').classList.remove('hidden');
  $('#filterLabel').textContent = label;
}

function hideFilterBanner() {
  $('#filterBanner').classList.add('hidden');
}

// ---------------------- Filtering ----------------------
function applyFilter(field, value) {
  activeFilter = { field, value };
  showFilterBanner(`${field}: ${value}`);

  $$('#epicTable tbody tr').forEach(row => {
    const cellValue = row.dataset[field] || '';
    const match = cellValue.toLowerCase().includes(value.toLowerCase());
    row.style.display = match ? '' : 'none';
  });
  updateVisibleCount();
}

function clearAllFilters() {
  activeFilter = { field: null, value: null };
  hideFilterBanner();
  $('#searchInput').value = '';
  $$('#epicTable tbody tr').forEach(row => { row.style.display = ''; });
  updateVisibleCount();
}
// Expose globally for the HTML onclick
window.clearAllFilters = clearAllFilters;

// ---------------------- Search ----------------------
$('#searchInput').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  if (!q) {
    // If had chart filter, reapply it; else show all
    if (activeFilter.field) {
      applyFilter(activeFilter.field, activeFilter.value);
    } else {
      $$('#epicTable tbody tr').forEach(r => { r.style.display = ''; });
    }
    updateVisibleCount();
    return;
  }
  // Text search overrides chart filter
  $$('#epicTable tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  updateVisibleCount();
});

// ---------------------- Sort ----------------------
let sortDir = {};
function sortTable(colIdx) {
  const tbody = $('#epicTable tbody');
  const rows = Array.from(tbody.rows);
  const dir = sortDir[colIdx] = !(sortDir[colIdx] || false);

  rows.sort((a, b) => {
    const av = (a.cells[colIdx]?.textContent || '').trim().toLowerCase();
    const bv = (b.cells[colIdx]?.textContent || '').trim().toLowerCase();
    return dir ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  rows.forEach(r => tbody.appendChild(r));
}
window.sortTable = sortTable;

// ---------------------- Chart factory ----------------------
function makeChart(canvasId, type, labels, values, bgColors, dataField) {
  const ctx = document.getElementById(canvasId);
  const chart = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderWidth: type === 'doughnut' ? 2 : 0,
        borderColor: '#fff',
        borderRadius: type === 'bar' ? 4 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: type === 'bar' && labels.length > 6 ? 'y' : 'x',
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const clickedLabel = labels[idx];
        if (activeFilter.field === dataField && activeFilter.value === clickedLabel) {
          clearAllFilters();
        } else {
          applyFilter(dataField, clickedLabel);
        }
      },
      plugins: {
        legend: { display: type === 'doughnut', position: 'right' },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed || ctx.raw}`,
          },
        },
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } },
      },
    },
  });
  return chart;
}

// ---------------------- Gantt Chart ----------------------
function buildGantt() {
  const STATUS_COLORS = {
    'Work in Progress': '#0053e2',
    'In Progress': '#0053e2',
    'Blocked': '#ea1100',
    'Listo': '#2a8703',
    'Backlog': '#6B7280',
  };

  const labels = GANTT_DATA.map(e => `${e.key} — ${e.summary}`);
  const data = GANTT_DATA.map(e => {
    const start = new Date(e.start + 'T00:00:00').getTime();
    const end = new Date(e.end + 'T00:00:00').getTime();
    return [start, end];
  });
  const bgColors = GANTT_DATA.map(e => STATUS_COLORS[e.status] || '#6B7280');

  const today = new Date();
  today.setHours(0,0,0,0);

  new Chart(document.getElementById('ganttChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: bgColors,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const e = GANTT_DATA[ctx.dataIndex];
              return [
                `${e.key}: ${e.summary}`,
                `Inicio: ${e.start}`,
                `Fin: ${e.end}`,
                `Estado: ${e.status}`,
                `Assignee: ${e.assignee}`,
              ];
            },
          },
        },
        // Today line annotation via custom plugin
        todayLine: {},
      },
      scales: {
        x: {
          type: 'linear',
          position: 'top',
          ticks: {
            callback: (val) => {
              const d = new Date(val);
              return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
            },
            font: { size: 10 },
            maxRotation: 0,
          },
          grid: { color: '#f0f0f0' },
        },
        y: {
          ticks: {
            font: { size: 10 },
            callback: function(val, idx) {
              const label = this.getLabelForValue(val);
              return label.length > 55 ? label.substring(0, 55) + '...' : label;
            },
          },
          grid: { display: false },
        },
      },
    },
    plugins: [{
      id: 'todayLine',
      afterDraw: (chart) => {
        const xScale = chart.scales.x;
        const todayX = xScale.getPixelForValue(today.getTime());
        if (todayX < xScale.left || todayX > xScale.right) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = '#ea1100';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(todayX, chart.scales.y.top);
        ctx.lineTo(todayX, chart.scales.y.bottom);
        ctx.stroke();
        // Label
        ctx.fillStyle = '#ea1100';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HOY', todayX, chart.scales.y.top - 5);
        ctx.restore();
      },
    }],
  });
}

if (GANTT_DATA.length > 0) buildGantt();

// ---------------------- Build all charts ----------------------
const CD = CHART_DATA;

makeChart('statusChart',   'doughnut', CD.status.labels,   CD.status.values,   PALETTE, 'status');
makeChart('dominioChart',  'bar',      CD.dominio.labels,  CD.dominio.values,  [WM.blue], 'dominio');
makeChart('equipoChart',   'bar',      CD.equipo.labels,   CD.equipo.values,   [WM.spark], 'equipo');
makeChart('servicioChart', 'bar',      CD.servicio.labels, CD.servicio.values, ['#6366f1'], 'servicio');
makeChart('appChart',      'bar',      CD.app.labels,      CD.app.values,      ['#06b6d4'], 'app');
makeChart('tipoChart',     'doughnut', CD.tipo.labels,     CD.tipo.values,     [WM.blue, WM.spark, WM.green, WM.red], 'tipo');
makeChart('assigneeChart', 'bar',      CD.assignee.labels, CD.assignee.values, [WM.blue], 'assignee');
makeChart('monthlyChart',  'bar',      CD.monthly.labels,  CD.monthly.values,  [WM.green], 'month');
