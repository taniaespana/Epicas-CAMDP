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
  // Also filter Gantt
  buildGantt();
}

function clearAllFilters() {
  activeFilter = { field: null, value: null };
  hideFilterBanner();
  $('#searchInput').value = '';
  $$('#epicTable tbody tr').forEach(row => { row.style.display = ''; });
  updateVisibleCount();
  // Reset Gantt
  buildGantt();
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
const GANTT_COLORS = {
  on_track:  '#2a8703',  // verde  — en tiempo
  extended:  '#0053e2',  // azul   — extendida (planned < due)
  blocked:   '#ea1100',  // rojo   — bloqueada
};

let ganttChart = null;
let ganttFilter = 'all';  // status filter

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function ganttMatchesChartFilter(e) {
  if (!activeFilter.field) return true;
  const f = activeFilter.field;
  const v = activeFilter.value.toLowerCase();
  // Direct field match first
  const directVal = (e[f] || '').toLowerCase();
  if (directVal.includes(v)) return true;
  // For month filter, match start date prefix
  if (f === 'month') return (e.start || '').startsWith(activeFilter.value);
  return false;
}

function filteredGantt() {
  let items = GANTT_DATA;
  // Apply status pill filter
  if (ganttFilter !== 'all') {
    items = items.filter(e => e.status === ganttFilter);
  }
  // Apply chart click filter
  if (activeFilter.field) {
    items = items.filter(e => ganttMatchesChartFilter(e));
  }
  return items;
}

function buildGantt() {
  const items = filteredGantt();
  if (!items.length) return;

  const labels = items.map(e => `${e.key} — ${e.summary}`);

  // Compute global min/max for stable axis
  let allDates = [];
  items.forEach(e => {
    allDates.push(parseDate(e.start));
    allDates.push(parseDate(e.end));
  });
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  // Add 7-day padding
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  const data = items.map(e => {
    return [parseDate(e.start).getTime(), parseDate(e.end).getTime()];
  });
  const bgColors = items.map(e => GANTT_COLORS[e.color] || '#6B7280');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Resize container
  const container = document.getElementById('ganttContainer');
  const h = Math.max(items.length * 34 + 60, 280);
  container.style.height = h + 'px';

  // Destroy previous chart if exists
  if (ganttChart) { ganttChart.destroy(); ganttChart = null; }

  ganttChart = new Chart(document.getElementById('ganttChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: bgColors.map(c => c),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.65,
        categoryPercentage: 0.85,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => {
              const e = items[ctx.dataIndex];
              const lines = [
                `${e.key}: ${e.summary}`,
                `Inicio: ${e.start}`,
                `Fin planeado: ${e.planned_done || '-'}`,
                `Due date: ${e.due || '-'}`,
                `Fin efectivo: ${e.end}`,
                `Estado: ${e.status}`,
                `Assignee: ${e.assignee}`,
              ];
              if (e.color === 'extended') lines.push('Extendida (planned < due)');
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          position: 'top',
          min: minDate.getTime(),
          max: maxDate.getTime(),
          ticks: {
            callback: (val) => {
              const d = new Date(val);
              return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
            },
            font: { size: 10 },
            maxRotation: 0,
            stepSize: 7 * 24 * 3600 * 1000,  // weekly ticks
          },
          grid: { color: '#f3f4f6' },
        },
        y: {
          ticks: {
            font: { size: 10 },
            callback: function(val) {
              const lbl = this.getLabelForValue(val);
              return lbl.length > 50 ? lbl.substring(0, 50) + '...' : lbl;
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
        const px = xScale.getPixelForValue(today.getTime());
        if (px < xScale.left || px > xScale.right) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = '#ea1100';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(px, chart.scales.y.top);
        ctx.lineTo(px, chart.scales.y.bottom);
        ctx.stroke();
        ctx.fillStyle = '#ea1100';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HOY', px, chart.scales.y.top - 6);
        ctx.restore();
      },
    }],
  });
}

function setGanttFilter(status) {
  ganttFilter = status;
  // Update pills UI
  document.querySelectorAll('.gantt-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.status === status);
  });
  buildGantt();
}
window.setGanttFilter = setGanttFilter;

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
