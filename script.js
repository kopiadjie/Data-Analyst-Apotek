/* ============================================================
   Dashboard Analitik Apotek 2025
   script.js — Data processing, KPI computation & Chart.js visualizations
   ============================================================ */

'use strict';

// ─── 1. GLOBAL CHART DEFAULTS ────────────────────────────────────────────────
Chart.defaults.font.family = '-apple-system, "Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#475569';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.padding        = 10;
Chart.defaults.plugins.tooltip.cornerRadius   = 8;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.85)';

// ─── 2. COLOUR PALETTE ───────────────────────────────────────────────────────
const COLORS = {
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  teal:    '#14b8a6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  sky:     '#0ea5e9',
  slate:   '#64748b',
  orange:  '#f97316',
};
const PALETTE = Object.values(COLORS);

// ─── 3. HELPERS ──────────────────────────────────────────────────────────────
const fmt = (n, dec = 0) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

const fmtRp = (n) => {
  if (n >= 1_000_000_000) return 'Rp ' + fmt(n / 1_000_000_000, 2) + ' M';
  if (n >= 1_000_000)     return 'Rp ' + fmt(n / 1_000_000, 1)    + ' Jt';
  return 'Rp ' + fmt(n);
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function groupBy(arr, keyFn) {
  return arr.reduce((acc, row) => {
    const k = keyFn(row);
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});
}

function sumField(arr, field) {
  return arr.reduce((s, r) => s + Number(r[field] || 0), 0);
}

function sumProfit(arr) {
  // Total Profit = SUM(margin × quantity)
  return arr.reduce((s, r) => s + Number(r.margin || 0) * Number(r.quantity || 0), 0);
}

// ─── 5. DATA PROCESSING ──────────────────────────────────────────────────────
function processData(rows) {
  /* ---- KPIs ---- */
  const totalRevenue      = sumField(rows, 'total_penjualan');
  const totalTransactions = rows.length;
  const totalQuantity     = sumField(rows, 'quantity');
  const totalProfit       = sumProfit(rows);

  /* ---- Daily trend ---- */
  const byDay = groupBy(rows, r => r.tanggal);
  const days  = Object.keys(byDay).sort();
  const dailyRevenue  = days.map(d => sumField(byDay[d], 'total_penjualan'));
  const dailyProfit   = days.map(d => sumProfit(byDay[d]));

  /* ---- Monthly revenue & profit ---- */
  const byMonth = groupBy(rows, r => r.tanggal.substring(0, 7));
  const months  = Object.keys(byMonth).sort();
  const monthlyRevenue = months.map(m => sumField(byMonth[m], 'total_penjualan'));
  const monthlyProfit  = months.map(m => sumProfit(byMonth[m]));
  const monthLabels    = months.map(m => MONTH_NAMES[parseInt(m.split('-')[1], 10) - 1]);

  /* ---- Branch ---- */
  const byBranch   = groupBy(rows, r => r.lokasi_cabang);
  const branches   = Object.keys(byBranch).sort();
  const branchRev  = branches.map(b => sumField(byBranch[b], 'total_penjualan'));
  const branchProf = branches.map(b => sumProfit(byBranch[b]));
  const branchTx   = branches.map(b => byBranch[b].length);

  /* ---- Category ---- */
  const byCat     = groupBy(rows, r => r.kategori_terapi);
  const cats      = Object.keys(byCat).sort();
  const catQty    = cats.map(c => sumField(byCat[c], 'quantity'));
  const catRev    = cats.map(c => sumField(byCat[c], 'total_penjualan'));
  const catProfit = cats.map(c => sumProfit(byCat[c]));

  /* ---- Profitability per product ---- */
  const byProduct = groupBy(rows, r => r.produk);
  const products  = Object.keys(byProduct).sort();
  const prodProfit = products.map(p => sumProfit(byProduct[p]));
  const prodRev    = products.map(p => sumField(byProduct[p], 'total_penjualan'));
  const prodQty    = products.map(p => sumField(byProduct[p], 'quantity'));
  const prodAvgMargin = products.map(p => {
    const qty = sumField(byProduct[p], 'quantity');
    return qty ? sumProfit(byProduct[p]) / qty : 0;
  });

  // Top 10 by profit
  const prodIdx = products.map((_, i) => i).sort((a, b) => prodProfit[b] - prodProfit[a]);
  const top10Idx = prodIdx.slice(0, 10);

  /* ---- Pharmacist ---- */
  const byPharm   = groupBy(rows, r => r.apoteker);
  const pharmNames = Object.keys(byPharm).sort();
  const pharmRev  = pharmNames.map(p => sumField(byPharm[p], 'total_penjualan'));
  const pharmProf = pharmNames.map(p => sumProfit(byPharm[p]));
  const pharmTx   = pharmNames.map(p => byPharm[p].length);

  /* ---- Discount impact ---- */
  const discGroups = { '0%': [], '1–5%': [], '6–10%': [], '11–15%': [] };
  rows.forEach(r => {
    const d = Number(r.diskon_persen);
    if (d === 0)        discGroups['0%'].push(r);
    else if (d <= 5)    discGroups['1–5%'].push(r);
    else if (d <= 10)   discGroups['6–10%'].push(r);
    else                discGroups['11–15%'].push(r);
  });
  const discLabels = Object.keys(discGroups);
  const discRev    = discLabels.map(k => sumField(discGroups[k], 'total_penjualan'));
  const discProfit = discLabels.map(k => sumProfit(discGroups[k]));
  const discCount  = discLabels.map(k => discGroups[k].length);

  /* ---- Seasonal index by month ---- */
  const seasonalAvg = months.map(m => {
    const arr = byMonth[m];
    return arr.reduce((s, r) => s + Number(r.indeks_musiman || 0), 0) / arr.length;
  });

  /* ---- Scatter: volume vs avg margin per product ---- */
  const scatterData = products.map((p, i) => ({
    x: prodQty[i],
    y: Math.round(prodAvgMargin[i]),
    label: p,
  }));

  return {
    totalRevenue, totalTransactions, totalQuantity, totalProfit,
    days, dailyRevenue, dailyProfit,
    monthLabels, monthlyRevenue, monthlyProfit,
    branches, branchRev, branchProf, branchTx,
    cats, catQty, catRev, catProfit,
    products, prodProfit, prodRev, prodQty, prodAvgMargin,
    top10Idx,
    pharmNames, pharmRev, pharmProf, pharmTx,
    discLabels, discRev, discProfit, discCount,
    seasonalAvg, monthLabels,
    scatterData,
  };
}

// ─── 6. KPI RENDER ───────────────────────────────────────────────────────────
function renderKPI(d) {
  document.getElementById('kpi-revenue').textContent      = fmtRp(d.totalRevenue);
  document.getElementById('kpi-revenue-sub').textContent  = `Rata-rata harian: ${fmtRp(d.totalRevenue / d.days.length)}`;

  document.getElementById('kpi-transactions').textContent = fmt(d.totalTransactions);
  document.getElementById('kpi-tx-sub').textContent       = `Rata-rata harian: ${fmt(d.totalTransactions / d.days.length, 1)} transaksi`;

  document.getElementById('kpi-quantity').textContent     = fmt(d.totalQuantity);
  document.getElementById('kpi-qty-sub').textContent      = `Rata-rata per transaksi: ${fmt(d.totalQuantity / d.totalTransactions, 1)} unit`;

  document.getElementById('kpi-profit').textContent       = fmtRp(d.totalProfit);
  const margin = (d.totalProfit / d.totalRevenue) * 100;
  document.getElementById('kpi-profit-sub').textContent   = `Margin rata-rata: ${fmt(margin, 1)}%`;
}

// ─── 7. CHART BUILDERS ───────────────────────────────────────────────────────

/* 7a. Daily Sales Trend */
function buildSalesTrend(d) {
  const ctx = document.getElementById('chartSalesTrend').getContext('2d');

  // Sample every 7th day for readability (365 → ~52 points)
  const step    = 7;
  const sampled = d.days.filter((_, i) => i % step === 0);
  const vals    = d.dailyRevenue.filter((_, i) => i % step === 0);
  const labels  = sampled.map(dt => {
    const [, m, day] = dt.split('-');
    return `${day}/${m}`;
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Rp)',
        data: vals,
        borderColor: COLORS.blue,
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
        y: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 5 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmtRp(ctx.parsed.y) } },
      },
    },
  });
}

/* 7b. Monthly Revenue */
function buildMonthlyRevenue(d) {
  const ctx = document.getElementById('chartMonthlyRevenue').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.monthLabels,
      datasets: [
        {
          label: 'Revenue',
          data: d.monthlyRevenue,
          backgroundColor: COLORS.blue,
          borderRadius: 6,
          order: 1,
        },
        {
          label: 'Profit',
          data: d.monthlyProfit,
          backgroundColor: COLORS.emerald,
          borderRadius: 6,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 5 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + fmtRp(ctx.parsed.y) } },
      },
    },
  });
}

/* 7c. Revenue per Branch */
function buildBranch(d) {
  const ctx = document.getElementById('chartBranch').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.branches,
      datasets: [
        {
          label: 'Revenue',
          data: d.branchRev,
          backgroundColor: [COLORS.blue, COLORS.indigo, COLORS.violet],
          borderRadius: 8,
        },
        {
          label: 'Profit',
          data: d.branchProf,
          backgroundColor: [COLORS.teal, COLORS.emerald, COLORS.sky],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 5 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + fmtRp(ctx.parsed.y) } },
      },
    },
  });
}

/* 7d. Sales per Category */
function buildCategory(d) {
  const ctx = document.getElementById('chartCategory').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: d.cats,
      datasets: [{
        data: d.catRev,
        backgroundColor: PALETTE.slice(0, d.cats.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { padding: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${fmtRp(ctx.parsed)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

/* 7e. Profitability per Product */
function buildProfitProduct(d) {
  const ctx = document.getElementById('chartProfitProduct').getContext('2d');
  const sorted = d.products.map((p, i) => ({ p, v: d.prodProfit[i] }))
                           .sort((a, b) => b.v - a.v);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x.p),
      datasets: [{
        label: 'Total Profit (Rp)',
        data: sorted.map(x => x.v),
        backgroundColor: sorted.map((_, i) =>
          `hsla(${200 + i * 15},70%,55%,0.85)`),
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 4 },
          grid: { color: '#f1f5f9' },
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + fmtRp(ctx.parsed.x) } },
      },
    },
  });
}

/* 7f. Top 10 Most Profitable Products */
function buildTop10(d) {
  const ctx = document.getElementById('chartTop10').getContext('2d');
  const labels = d.top10Idx.map(i => d.products[i]);
  const profits = d.top10Idx.map(i => d.prodProfit[i]);
  const revenues = d.top10Idx.map(i => d.prodRev[i]);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Profit (Rp)',
          data: profits,
          backgroundColor: COLORS.emerald,
          borderRadius: 5,
        },
        {
          label: 'Revenue (Rp)',
          data: revenues,
          backgroundColor: 'rgba(59,130,246,0.25)',
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 4 },
          grid: { color: '#f1f5f9' },
        },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + fmtRp(ctx.parsed.x) } },
      },
    },
  });
}

/* 7g. Revenue per Pharmacist */
function buildPharmacist(d) {
  const ctx = document.getElementById('chartPharmacist').getContext('2d');
  const sorted = d.pharmNames.map((p, i) => ({ p, r: d.pharmRev[i], pr: d.pharmProf[i], tx: d.pharmTx[i] }))
                             .sort((a, b) => b.r - a.r);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x.p),
      datasets: [
        {
          label: 'Revenue',
          data: sorted.map(x => x.r),
          backgroundColor: COLORS.blue,
          borderRadius: 6,
        },
        {
          label: 'Profit',
          data: sorted.map(x => x.pr),
          backgroundColor: COLORS.emerald,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 5 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              return `Transaksi: ${fmt(sorted[idx].tx)}`;
            },
          },
        },
      },
    },
  });
}

/* 7h. Discount Impact */
function buildDiscount(d) {
  const ctx = document.getElementById('chartDiscount').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.discLabels,
      datasets: [
        {
          label: 'Revenue',
          data: d.discRev,
          backgroundColor: COLORS.amber,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Profit',
          data: d.discProfit,
          backgroundColor: COLORS.rose,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Jumlah Transaksi',
          data: d.discCount,
          type: 'line',
          borderColor: COLORS.slate,
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 5,
          borderWidth: 2,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: v => fmtRp(v), maxTicksLimit: 5 },
          grid: { color: '#f1f5f9' },
          position: 'left',
        },
        y2: {
          position: 'right',
          grid: { display: false },
          ticks: { maxTicksLimit: 5 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.dataset.yAxisID === 'y2') return ` ${fmt(ctx.parsed.y)} transaksi`;
              return ' ' + fmtRp(ctx.parsed.y);
            },
          },
        },
      },
    },
  });
}

/* 7i. Seasonal Index */
function buildSeasonal(d) {
  const ctx = document.getElementById('chartSeasonal').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.monthLabels,
      datasets: [{
        label: 'Indeks Musiman Rata-rata',
        data: d.seasonalAvg,
        borderColor: COLORS.violet,
        backgroundColor: 'rgba(139,92,246,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 0.8,
          max: 1.4,
          ticks: { maxTicksLimit: 6, stepSize: 0.1 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' Indeks: ' + ctx.parsed.y.toFixed(3) } },
      },
    },
  });
}

/* 7j. Scatter: Volume vs Avg Margin */
function buildScatter(d) {
  const ctx = document.getElementById('chartScatter').getContext('2d');
  const totalQty = d.scatterData.reduce((s, p) => s + p.x, 0);
  const avgMargin = d.scatterData.reduce((s, p) => s + p.y, 0) / d.scatterData.length;

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Produk',
        data: d.scatterData,
        backgroundColor: d.scatterData.map((p) => {
          const highVol  = p.x > (totalQty / d.scatterData.length);
          const lowMargin = p.y < avgMargin;
          if (highVol && lowMargin)  return 'rgba(244,63,94,0.75)';   // High vol, low margin → risk
          if (highVol && !lowMargin) return 'rgba(16,185,129,0.75)';  // High vol, high margin → star
          if (!highVol && lowMargin) return 'rgba(100,116,139,0.6)';  // Low vol, low margin → idle
          return 'rgba(59,130,246,0.75)';                             // Low vol, high margin → niche
        }),
        pointRadius: 10,
        pointHoverRadius: 13,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Total Quantity' },
          ticks: { maxTicksLimit: 6 },
          grid: { color: '#f1f5f9' },
        },
        y: {
          title: { display: true, text: 'Avg Margin/Unit (Rp)' },
          ticks: { callback: v => fmt(v), maxTicksLimit: 6 },
          grid: { color: '#f1f5f9' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return [`${pt.label}`, `Qty: ${fmt(pt.x)}`, `Avg Margin: Rp ${fmt(pt.y)}`];
            },
          },
        },
      },
    },
  });
}

// ─── 8. INSIGHTS GENERATOR ───────────────────────────────────────────────────
function buildInsights(d) {
  const container = document.getElementById('insights-container');

  /* Derived values */
  const topProfIdx   = d.prodProfit.indexOf(Math.max(...d.prodProfit));
  const topProdName  = d.products[topProfIdx];
  const topProdProfit = d.prodProfit[topProfIdx];

  const topBranchIdx = d.branchRev.indexOf(Math.max(...d.branchRev));
  const topBranch    = d.branches[topBranchIdx];

  const peakMonthIdx = d.monthlyRevenue.indexOf(Math.max(...d.monthlyRevenue));
  const peakMonth    = d.monthLabels[peakMonthIdx];
  const peakRevenue  = d.monthlyRevenue[peakMonthIdx];

  const lowMonthIdx  = d.monthlyRevenue.indexOf(Math.min(...d.monthlyRevenue));
  const lowMonth     = d.monthLabels[lowMonthIdx];

  const totalQtyAvg  = d.totalQuantity / d.products.length;
  const highVolLowM  = d.scatterData.filter(p => p.x > totalQtyAvg && p.y < d.scatterData.reduce((s, x) => s + x.y, 0) / d.scatterData.length);

  const maxSeasonIdx = d.seasonalAvg.indexOf(Math.max(...d.seasonalAvg));
  const minSeasonIdx = d.seasonalAvg.indexOf(Math.min(...d.seasonalAvg));

  const profitMargin = ((d.totalProfit / d.totalRevenue) * 100).toFixed(1);

  const topPharmIdx  = d.pharmRev.indexOf(Math.max(...d.pharmRev));
  const topPharm     = d.pharmNames[topPharmIdx];

  const insights = [
    {
      type: 'fact',
      label: '📊 Fakta',
      text: `Total revenue 2025 mencapai <strong>${fmtRp(d.totalRevenue)}</strong> dari <strong>${fmt(d.totalTransactions)}</strong> transaksi dengan margin profit rata-rata <strong>${profitMargin}%</strong>.`,
    },
    {
      type: 'fact',
      label: '🏆 Produk Terlaris',
      text: `<strong>${topProdName}</strong> menjadi produk paling menguntungkan dengan total profit <strong>${fmtRp(topProdProfit)}</strong> sepanjang 2025.`,
    },
    {
      type: 'fact',
      label: '🏥 Cabang Terbaik',
      text: `<strong>${topBranch}</strong> mencatat revenue tertinggi. Distribusi revenue antar cabang menunjukkan ketimpangan yang perlu diperhatikan.`,
    },
    {
      type: 'interp',
      label: '📅 Pola Musiman',
      text: `Permintaan tertinggi terjadi di bulan <strong>${d.monthLabels[maxSeasonIdx]}</strong> (indeks: ${d.seasonalAvg[maxSeasonIdx].toFixed(3)}) dan terendah di <strong>${d.monthLabels[minSeasonIdx]}</strong>. Pola ini mengindikasikan fluktuasi permintaan yang perlu diantisipasi dalam pengadaan.`,
    },
    {
      type: 'interp',
      label: '📈 Puncak Penjualan',
      text: `Bulan <strong>${peakMonth}</strong> adalah periode revenue tertinggi (${fmtRp(peakRevenue)}), sementara <strong>${lowMonth}</strong> adalah bulan paling lemah. Strategi promosi dapat difokuskan untuk meningkatkan performa di bulan low-season.`,
    },
    {
      type: 'interp',
      label: '⚠️ Volume Tinggi – Margin Rendah',
      text: highVolLowM.length > 0
        ? `Produk <strong>${highVolLowM.map(p => p.label).join(', ')}</strong> memiliki volume penjualan tinggi namun margin rendah. Perlu evaluasi negosiasi harga beli atau penyesuaian harga jual.`
        : `Semua produk bervolume tinggi memiliki margin yang memadai. Struktur harga saat ini sudah cukup optimal.`,
    },
    {
      type: 'action',
      label: '🛒 Optimasi Pengadaan',
      text: `Tingkatkan stok produk pada bulan <strong>${d.monthLabels[maxSeasonIdx]}</strong> (indeks musiman tinggi). Gunakan data indeks musiman sebagai panduan safety stock — bukan sebagai jaminan ketersediaan aktual.`,
    },
    {
      type: 'action',
      label: '💡 Strategi Diskon',
      text: `Analisis dampak diskon menunjukkan segmen transaksi terbesar ada di kelompok diskon tertentu. Evaluasi apakah pemberian diskon berkorelasi positif dengan volume atau justru menggerus profit. Pertimbangkan program loyalitas sebagai pengganti diskon flat.`,
    },
    {
      type: 'action',
      label: '👨‍⚕️ Pengembangan Apoteker',
      text: `<strong>${topPharm}</strong> adalah apoteker dengan kontribusi revenue tertinggi. Bagikan praktik terbaik ke seluruh apoteker melalui program coaching internal untuk mengurangi kesenjangan performa antar individu.`,
    },
  ];

  insights.forEach(ins => {
    const card = document.createElement('div');
    card.className = `insight-card ${ins.type}`;
    card.innerHTML = `
      <span class="insight-badge ${ins.type}">${ins.label}</span>
      <p class="insight-text">${ins.text}</p>
    `;
    container.appendChild(card);
  });
}

// ─── 9. MAIN ENTRY ───────────────────────────────────────────────────────────
async function init() {
  const statusEl = document.getElementById('data-status');

  try {
    statusEl.textContent = 'Memuat JSON…';

    const response = await fetch('penjualan_farmasi_2025.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    statusEl.textContent = 'Memproses data…';

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('JSON kosong atau format tidak valid.');

    const d = processData(rows);

    statusEl.textContent = `✅ ${fmt(rows.length)} baris | ${d.branches.length} cabang | ${d.products.length} produk`;
    statusEl.classList.add('bg-green-700/60');

    renderKPI(d);
    buildSalesTrend(d);
    buildMonthlyRevenue(d);
    buildBranch(d);
    buildCategory(d);
    buildProfitProduct(d);
    buildTop10(d);
    buildPharmacist(d);
    buildDiscount(d);
    buildSeasonal(d);
    buildScatter(d);
    buildInsights(d);

  } catch (err) {
    console.error(err);
    statusEl.textContent = `❌ Error: ${err.message}`;
    statusEl.classList.add('bg-red-700/60');
  }
}

document.addEventListener('DOMContentLoaded', init);
