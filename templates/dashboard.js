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
