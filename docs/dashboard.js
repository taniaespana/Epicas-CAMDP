/* =========================================================
   CAMDP Dashboard — Dynamic charts, week slicer, cross-filter
   ========================================================= */

const WM = { blue: '#0053e2', spark: '#ffc220', green: '#2a8703', red: '#ea1100' };
const PALETTE = [
  '#0053e2','#2a8703','#ea1100','#ffc220','#6366f1','#06b6d4',
  '#8b5cf6','#f97316','#ec4899','#14b8a6','#a855f7','#0891b2',
];
const GANTT_COLORS = { on_track: '#2a8703', extended: '#0053e2', blocked: '#ea1100' };

// ------------------------------------------------------------------ //
//  STATE                                                              //
// ------------------------------------------------------------------ //
const ganttCharts = {};
const ganttFilters = {};
const chartInstances = {};
const activeFilters = {};

DOMAIN_SLUGS.forEach(s => {
  activeFilters[s] = { week: 'all', epicKey: '', service: '', status: '' };
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ------------------------------------------------------------------ //
//  AGGREGATION                                                        //
// ------------------------------------------------------------------ //

function countBy(items, keyFn) {
  const m = {};
  items.forEach(i => { const k = keyFn(i) || 'Sin dato'; m[k] = (m[k] || 0) + 1; });
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

function avg(arr) { return arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0; }
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function aggregateIssues(issues) {
  const serviceDist = countBy(issues, i => i.sv);
  const statusDist  = countBy(issues, i => i.s);

  // Control chart series sorted by UPDATED (so all points are 2026+)
  const sorted = [...issues].sort((a, b) => a.u.localeCompare(b.u));
  const ctPoints = [], ltPoints = [], ctVals = [], ltVals = [];
  sorted.forEach(i => {
    if (i.ct != null) { ctPoints.push({ x: i.u, y: i.ct, key: i.k }); ctVals.push(i.ct); }
    if (i.lt != null) { ltPoints.push({ x: i.u, y: i.lt, key: i.k }); ltVals.push(i.lt); }
  });
  const ctMean = avg(ctVals), ltMean = avg(ltVals);
  const ctStd = stddev(ctVals), ltStd = stddev(ltVals);

  return {
    service: serviceDist,
    status: statusDist,
    cycleTime: {
      points: ctPoints, mean: ctMean,
      ucl: +(ctMean + 2 * ctStd).toFixed(1),
      lcl: +Math.max(ctMean - 2 * ctStd, 0).toFixed(1),
    },
    leadTime: {
      points: ltPoints, mean: ltMean,
      ucl: +(ltMean + 2 * ltStd).toFixed(1),
      lcl: +Math.max(ltMean - 2 * ltStd, 0).toFixed(1),
    },
  };
}

// ------------------------------------------------------------------ //
//  FILTERING                                                          //
// ------------------------------------------------------------------ //

function getFilteredIssues(slug) {
  let issues = ISSUES_DATA[slug] || [];
  const f = activeFilters[slug];
  if (f.week && f.week !== 'all') issues = issues.filter(i => i.w === f.week);
  if (f.epicKey)  issues = issues.filter(i => i.ek === f.epicKey);
  if (f.service)  issues = issues.filter(i => i.sv === f.service || i.sv.includes(f.service));
  if (f.status)   issues = issues.filter(i => i.s === f.status);
  return issues;
}

function applyFilters(slug) {
  const issues = getFilteredIssues(slug);
  const agg = aggregateIssues(issues);
  rebuildCharts(slug, agg);
  updateFilterBadges(slug);
}

function updateFilterBadges(slug) {
  const f = activeFilters[slug];
  const container = $(`#activeFilters-${slug}`);
  if (!container) return;
  let html = '';
  if (f.epicKey)  html += makeBadge(slug, 'epicKey', `🎯 ${f.epicKey}`);
  if (f.service)  html += makeBadge(slug, 'service', `⚙️ ${f.service}`);
  if (f.status)   html += makeBadge(slug, 'status', `🟢 ${f.status}`);
  container.innerHTML = html;
  container.classList.toggle('hidden', !html);
}

function makeBadge(slug, key, label) {
  return `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mr-2">
    ${label}
    <button onclick="clearFilter('${slug}','${key}')" class="ml-1 text-blue-500 hover:text-red-600 font-bold" aria-label="Quitar filtro">&times;</button>
  </span>`;
}

function clearFilter(slug, key) {
  activeFilters[slug][key] = '';
  applyFilters(slug);
}
window.clearFilter = clearFilter;

function clearAllFilters(slug) {
  const f = activeFilters[slug];
  f.epicKey = ''; f.service = ''; f.status = '';
  applyFilters(slug);
}
window.clearAllFilters = clearAllFilters;

// ------------------------------------------------------------------ //
//  CHART FACTORY                                                      //
// ------------------------------------------------------------------ //

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function makeBarOrDoughnut(canvasId, type, labels, values, bgColors, opts = {}) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !labels.length) return null;
  const isH = type === 'bar' && (labels.length > 6 || opts.horizontal);
  const slug = canvasId.split('-').slice(1).join('-');
  const chartType = canvasId.split('-')[0].replace('Chart','');

  const chart = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        label: opts.label || '', data: values,
        backgroundColor: bgColors.length === 1 ? labels.map(() => bgColors[0]) : bgColors.slice(0, labels.length),
        borderWidth: type === 'doughnut' ? 2 : 0, borderColor: '#fff', borderRadius: type === 'bar' ? 4 : 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: isH ? 'y' : 'x',
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const clicked = labels[idx];
        // Cross-filter: service chart -> filter by service, status -> filter by status
        if (chartType === 'service') {
          activeFilters[slug].service = activeFilters[slug].service === clicked ? '' : clicked;
        } else if (chartType === 'status') {
          activeFilters[slug].status = activeFilters[slug].status === clicked ? '' : clicked;
        }
        applyFilters(slug);
      },
      plugins: {
        legend: { display: type === 'doughnut', position: 'right' },
        tooltip: { callbacks: { afterLabel: () => '👉 Clic para filtrar' } },
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } }, beginAtZero: true },
      },
    },
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function makeControlChart(canvasId, data, color) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data?.points?.length) return null;

  const pts = data.points;
  const labels = pts.map((_, i) => i);
  const values = pts.map(p => p.y);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Días', data: values,
          backgroundColor: values.map(v =>
            v > data.ucl ? '#ea1100' : (v > data.mean ? color + '99' : color + '66')
          ),
          borderWidth: 0, borderRadius: 1, barPercentage: 1.0, categoryPercentage: 1.0,
        },
        { label: `Media (${data.mean}d)`, data: pts.map(() => data.mean), type: 'line',
          borderColor: '#000', borderWidth: 2, borderDash: [6, 3], pointRadius: 0, fill: false },
        { label: `UCL (${data.ucl}d)`, data: pts.map(() => data.ucl), type: 'line',
          borderColor: '#ea1100', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false },
        { label: `LCL (${data.lcl}d)`, data: pts.map(() => data.lcl), type: 'line',
          borderColor: '#2a8703', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } },
        tooltip: { callbacks: {
          title: (items) => { const p = pts[items[0]?.dataIndex]; return p ? `${p.key} (${p.x})` : ''; },
          label: (ctx) => ctx.datasetIndex === 0 ? ` ${ctx.raw} días` : null,
        }},
      },
      scales: {
        x: { display: true, ticks: { maxTicksLimit: 15, callback: v => pts[v]?.x || '', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: '#f3f4f6' } },
      },
    },
  });
  chartInstances[canvasId] = chart;
  return chart;
}

function rebuildCharts(slug, agg) {
  const svc = agg.service;
  makeBarOrDoughnut(`serviceChart-${slug}`, 'bar', Object.keys(svc), Object.values(svc), [WM.blue], { horizontal: true });
  const st = agg.status;
  makeBarOrDoughnut(`statusChart-${slug}`, 'doughnut', Object.keys(st), Object.values(st), PALETTE);
  makeControlChart(`cycleTimeChart-${slug}`, agg.cycleTime, '#6366f1');
  makeControlChart(`leadTimeChart-${slug}`, agg.leadTime, '#f97316');
}

// ------------------------------------------------------------------ //
//  TAB SWITCHING                                                      //
// ------------------------------------------------------------------ //

const builtTabs = {};

function switchTab(slug) {
  $$('.domain-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === slug));
  $$('.tab-content').forEach(d => d.classList.toggle('active', d.id === `tab-${slug}`));
  if (!builtTabs[slug]) {
    applyFilters(slug);
    builtTabs[slug] = true;
  }
  if (GANTT_DATA[slug]?.length && !ganttCharts[slug]) buildGantt(slug);
}
window.switchTab = switchTab;

// ------------------------------------------------------------------ //
//  WEEK SLICER                                                        //
// ------------------------------------------------------------------ //

$$('.week-slicer').forEach(sel => {
  sel.addEventListener('change', function () {
    const slug = this.dataset.domain;
    activeFilters[slug].week = this.value;
    builtTabs[slug] = false;
    applyFilters(slug);
    builtTabs[slug] = true;
  });
});

// ------------------------------------------------------------------ //
//  EPIC FILTER (Gantt click)                                          //
// ------------------------------------------------------------------ //

function setEpicFilter(slug, epicKey) {
  activeFilters[slug].epicKey = activeFilters[slug].epicKey === epicKey ? '' : epicKey;
  applyFilters(slug);
}

// ------------------------------------------------------------------ //
//  SEARCH                                                             //
// ------------------------------------------------------------------ //

function setupSearch() {
  const gi = $('#searchInput-general');
  if (gi) gi.addEventListener('input', function () {
    const q = this.value.toLowerCase();
    $$('#epicTable-general tbody tr').forEach(r => {
      r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  $$('.domain-search').forEach(input => {
    input.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      $$(`#${this.dataset.table} tbody tr`).forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  });
}
setupSearch();

// ------------------------------------------------------------------ //
//  GANTT                                                              //
// ------------------------------------------------------------------ //

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function buildGantt(slug) {
  const filter = ganttFilters[slug] || 'all';
  let items = GANTT_DATA[slug] || [];
  if (filter !== 'all') items = items.filter(e => e.status === filter);
  if (!items.length) return;

  const labels = items.map(e => `${e.key} \u2014 ${e.summary}`);
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
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const epicKey = items[idx].key;
        setEpicFilter(slug, epicKey);
      },
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
                '', '\ud83d\udc49 Clic para filtrar por esta \u00e9pica',
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
            callback: v => new Date(v).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
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
  if (ganttCharts[domain]) { ganttCharts[domain].destroy(); ganttCharts[domain] = null; }
  buildGantt(domain);
}
window.setGanttFilter = setGanttFilter;

// ------------------------------------------------------------------ //
//  INIT                                                               //
// ------------------------------------------------------------------ //

applyFilters('general');
builtTabs.general = true;
if (GANTT_DATA.general?.length) buildGantt('general');
