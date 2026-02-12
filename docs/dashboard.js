/* =========================================================
   CAMDP Dashboard — Tabs, Gantt, Cycle/Lead Time Charts
   ========================================================= */

const WM = { blue: '#0053e2', spark: '#ffc220', green: '#2a8703', red: '#ea1100' };
const PALETTE = [
  '#0053e2','#2a8703','#ea1100','#ffc220','#6366f1','#06b6d4',
  '#8b5cf6','#f97316','#ec4899','#14b8a6','#a855f7','#0891b2',
];
const GANTT_COLORS = { on_track: '#2a8703', extended: '#0053e2', blocked: '#ea1100' };

// ---------------------- State ----------------------
const ganttCharts = {};
const ganttFilters = {};
const builtTabs = {};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ---------------------- Tab Switching ----------------------
function switchTab(slug) {
  $$('.domain-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === slug));
  $$('.tab-content').forEach(d => d.classList.toggle('active', d.id === `tab-${slug}`));
  if (!builtTabs[slug]) {
    buildTabCharts(slug);
    builtTabs[slug] = true;
  }
  if (GANTT_DATA[slug]?.length) buildGantt(slug);
}
window.switchTab = switchTab;

// ---------------------- Search ----------------------
function setupSearch() {
  // General search
  const gi = $('#searchInput-general');
  if (gi) gi.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    $$('#epicTable-general tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  // Domain searches
  $$('.domain-search').forEach(input => {
    input.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      const tableId = this.dataset.table;
      $$(`#${tableId} tbody tr`).forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  });
}
setupSearch();

// ---------------------- Chart Factory ----------------------
function makeChart(canvasId, type, labels, values, bgColors, opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !labels.length) return null;

  const isHorizontal = type === 'bar' && (labels.length > 6 || opts.horizontal);

  return new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        label: opts.label || '',
        data: values,
        backgroundColor: bgColors.length === 1
          ? labels.map(() => bgColors[0])
          : bgColors.slice(0, labels.length),
        borderWidth: type === 'doughnut' ? 2 : 0,
        borderColor: '#fff',
        borderRadius: type === 'bar' ? 4 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: isHorizontal ? 'y' : 'x',
      plugins: {
        legend: { display: type === 'doughnut', position: 'right' },
        tooltip: {
          callbacks: opts.tooltipCb || {},
        },
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } }, beginAtZero: true },
      },
    },
  });
}

// ---------------------- Build Charts for Tab ----------------------
function buildTabCharts(slug) {
  const cd = CHART_DATA[slug];
  if (!cd) return;

  if (cd.service?.labels?.length) {
    makeChart(`serviceChart-${slug}`, 'bar', cd.service.labels, cd.service.values,
      [WM.blue], { horizontal: true });
  }
  if (cd.status?.labels?.length) {
    makeChart(`statusChart-${slug}`, 'doughnut', cd.status.labels, cd.status.values, PALETTE);
  }
  if (cd.cycleTime?.labels?.length) {
    makeChart(`cycleTimeChart-${slug}`, 'bar', cd.cycleTime.labels, cd.cycleTime.values,
      ['#6366f1'], {
        horizontal: true,
        label: 'Días promedio',
        tooltipCb: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} días` },
      });
  }
  if (cd.leadTime?.labels?.length) {
    makeChart(`leadTimeChart-${slug}`, 'bar', cd.leadTime.labels, cd.leadTime.values,
      ['#f97316'], {
        horizontal: true,
        label: 'Días promedio',
        tooltipCb: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} días` },
      });
  }
}

// ---------------------- Gantt ----------------------
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function buildGantt(slug) {
  const filter = ganttFilters[slug] || 'all';
  let items = GANTT_DATA[slug] || [];
  if (filter !== 'all') items = items.filter(e => e.status === filter);
  if (!items.length) return;

  const labels = items.map(e => `${e.key} — ${e.summary}`);
  const allDates = items.flatMap(e => [parseDate(e.start), parseDate(e.end)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  const data = items.map(e => [parseDate(e.start).getTime(), parseDate(e.end).getTime()]);
  const bgColors = items.map(e => GANTT_COLORS[e.color] || '#6B7280');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const container = document.getElementById(`ganttContainer-${slug}`);
  if (!container) return;
  container.style.height = Math.max(items.length * 34 + 60, 280) + 'px';

  if (ganttCharts[slug]) { ganttCharts[slug].destroy(); ganttCharts[slug] = null; }

  ganttCharts[slug] = new Chart(document.getElementById(`ganttChart-${slug}`), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: bgColors, borderColor: bgColors,
        borderWidth: 1, borderRadius: 4, borderSkipped: false,
        barPercentage: 0.65, categoryPercentage: 0.85,
      }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => {
              const e = items[ctx.dataIndex];
              return [
                `${e.key}: ${e.summary}`, `Inicio: ${e.start}`,
                `Fin planeado: ${e.planned_done || '-'}`, `Due: ${e.due || '-'}`,
                `Estado: ${e.status}`, `Assignee: ${e.assignee}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear', position: 'top',
          min: minDate.getTime(), max: maxDate.getTime(),
          ticks: {
            callback: (v) => new Date(v).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
            font: { size: 10 }, maxRotation: 0, stepSize: 7 * 86400000,
          },
          grid: { color: '#f3f4f6' },
        },
        y: {
          ticks: {
            font: { size: 10 },
            callback: function (v) { const l = this.getLabelForValue(v); return l.length > 50 ? l.slice(0, 50) + '...' : l; },
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
        const c = chart.ctx;
        c.save(); c.strokeStyle = '#ea1100'; c.lineWidth = 2; c.setLineDash([6, 3]);
        c.beginPath(); c.moveTo(px, chart.scales.y.top); c.lineTo(px, chart.scales.y.bottom); c.stroke();
        c.fillStyle = '#ea1100'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
        c.fillText('HOY', px, chart.scales.y.top - 6); c.restore();
      },
    }],
  });
}

function setGanttFilter(domain, status) {
  ganttFilters[domain] = status;
  $$(`[data-domain="${domain}"].gantt-pill`).forEach(p =>
    p.classList.toggle('active', p.dataset.status === status)
  );
  buildGantt(domain);
}
window.setGanttFilter = setGanttFilter;

// ---------------------- Init ----------------------
buildTabCharts('general');
builtTabs.general = true;
if (GANTT_DATA.general?.length) buildGantt('general');
