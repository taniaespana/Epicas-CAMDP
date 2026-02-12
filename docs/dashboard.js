/* =========================================================
   CAMDP Dashboard — Tabs, Gantt Charts & Domain Views
   ========================================================= */

const WM = { blue: '#0053e2', spark: '#ffc220', green: '#2a8703', red: '#ea1100' };
const PALETTE = [
  '#0053e2','#2a8703','#ea1100','#ffc220','#6366f1','#06b6d4',
  '#8b5cf6','#f97316','#ec4899','#14b8a6','#a855f7','#0891b2',
];

const GANTT_COLORS = {
  on_track: '#2a8703',
  extended: '#0053e2',
  blocked:  '#ea1100',
};

// ---------------------- State ----------------------
let activeTab = 'general';
const ganttCharts = {};   // domain -> Chart instance
const ganttFilters = {};  // domain -> status filter
const domainCharts = {};  // domain -> { chartName: Chart }

// ---------------------- DOM helpers ----------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---------------------- Tab Switching ----------------------
function switchTab(slug) {
  activeTab = slug;

  // Update tab buttons
  $$('.domain-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === slug);
  });

  // Show/hide tab content
  $$('.tab-content').forEach(div => {
    div.classList.toggle('active', div.id === `tab-${slug}`);
  });

  // Build charts for this tab if not built yet
  if (!domainCharts[slug]) {
    buildDomainCharts(slug);
  }

  // Build/rebuild gantt for this tab
  if (GANTT_DATA[slug] && GANTT_DATA[slug].length > 0) {
    buildGantt(slug);
  }
}
window.switchTab = switchTab;

// ---------------------- Search (general tab) ----------------------
const searchInput = $('#searchInput-general');
if (searchInput) {
  searchInput.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    $$('#epicTable-general tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ---------------------- Chart factory ----------------------
function makeChart(canvasId, type, labels, values, bgColors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  return new Chart(canvas, {
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
      plugins: {
        legend: { display: type === 'doughnut', position: 'right' },
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } },
      },
    },
  });
}

// ---------------------- Build charts for a domain ----------------------
function buildDomainCharts(slug) {
  const cd = CHART_DATA[slug];
  if (!cd) return;

  domainCharts[slug] = {};

  if (cd.status) {
    domainCharts[slug].status = makeChart(
      `statusChart-${slug}`, 'doughnut', cd.status.labels, cd.status.values, PALETTE,
    );
  }
  if (cd.issuetype) {
    domainCharts[slug].issuetype = makeChart(
      `issuetypeChart-${slug}`, 'doughnut', cd.issuetype.labels, cd.issuetype.values, PALETTE,
    );
  }
  if (cd.dominio) {
    domainCharts[slug].dominio = makeChart(
      `dominioChart-${slug}`, 'bar', cd.dominio.labels, cd.dominio.values, [WM.blue],
    );
  }
  if (cd.equipo) {
    domainCharts[slug].equipo = makeChart(
      `equipoChart-${slug}`, 'bar', cd.equipo.labels, cd.equipo.values, [WM.spark],
    );
  }
  if (cd.assignee) {
    domainCharts[slug].assignee = makeChart(
      `assigneeChart-${slug}`, 'bar', cd.assignee.labels, cd.assignee.values, [WM.blue],
    );
  }
  if (cd.monthly) {
    domainCharts[slug].monthly = makeChart(
      `monthlyChart-${slug}`, 'bar', cd.monthly.labels, cd.monthly.values, [WM.green],
    );
  }
}

// ---------------------- Gantt Chart ----------------------
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function buildGantt(slug) {
  const statusFilter = ganttFilters[slug] || 'all';
  let items = GANTT_DATA[slug] || [];

  if (statusFilter !== 'all') {
    items = items.filter(e => e.status === statusFilter);
  }
  if (!items.length) return;

  const labels = items.map(e => `${e.key} — ${e.summary}`);
  const allDates = [];
  items.forEach(e => {
    allDates.push(parseDate(e.start));
    allDates.push(parseDate(e.end));
  });
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  minDate.setDate(minDate.getDate() - 7);
  maxDate.setDate(maxDate.getDate() + 14);

  const data = items.map(e => [parseDate(e.start).getTime(), parseDate(e.end).getTime()]);
  const bgColors = items.map(e => GANTT_COLORS[e.color] || '#6B7280');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const container = document.getElementById(`ganttContainer-${slug}`);
  if (!container) return;
  container.style.height = Math.max(items.length * 34 + 60, 280) + 'px';

  if (ganttCharts[slug]) {
    ganttCharts[slug].destroy();
    ganttCharts[slug] = null;
  }

  ganttCharts[slug] = new Chart(document.getElementById(`ganttChart-${slug}`), {
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
              return [
                `${e.key}: ${e.summary}`,
                `Inicio: ${e.start}`,
                `Fin planeado: ${e.planned_done || '-'}`,
                `Due date: ${e.due || '-'}`,
                `Estado: ${e.status}`,
                `Assignee: ${e.assignee}`,
              ];
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
            callback: (val) => new Date(val).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
            font: { size: 10 },
            maxRotation: 0,
            stepSize: 7 * 24 * 3600 * 1000,
          },
          grid: { color: '#f3f4f6' },
        },
        y: {
          ticks: {
            font: { size: 10 },
            callback: function (val) {
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
        const ctx2 = chart.ctx;
        ctx2.save();
        ctx2.strokeStyle = '#ea1100';
        ctx2.lineWidth = 2;
        ctx2.setLineDash([6, 3]);
        ctx2.beginPath();
        ctx2.moveTo(px, chart.scales.y.top);
        ctx2.lineTo(px, chart.scales.y.bottom);
        ctx2.stroke();
        ctx2.fillStyle = '#ea1100';
        ctx2.font = 'bold 10px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.fillText('HOY', px, chart.scales.y.top - 6);
        ctx2.restore();
      },
    }],
  });
}

function setGanttFilter(domain, status) {
  ganttFilters[domain] = status;
  // Update pills for this domain only
  $$(`[data-domain="${domain}"].gantt-pill`).forEach(pill => {
    pill.classList.toggle('active', pill.dataset.status === status);
  });
  buildGantt(domain);
}
window.setGanttFilter = setGanttFilter;

// ---------------------- Initialize General tab ----------------------
buildDomainCharts('general');
if (GANTT_DATA.general && GANTT_DATA.general.length > 0) {
  buildGantt('general');
}
