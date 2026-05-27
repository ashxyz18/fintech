/* =========================================================
   CRYPTOVAULT - SHARED JS (nav, ticker, auth state, toasts)
   ========================================================= */

/* ---------- NAV TOGGLE ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const tog = document.getElementById('menuToggle');
  const links = document.getElementById('navLinks');
  if (tog && links) tog.addEventListener('click', () => links.classList.toggle('open'));

  buildTicker();
  animateCounters();
  reflectAuthState();
  buildHeatmap();
  bindScrollReveal();
});

/* ---------- HEATMAP (landing page) ---------- */
function buildHeatmap() {
  const el = document.getElementById('heatmap');
  if (!el || typeof ALL_INSTRUMENTS === 'undefined') return;
  const sample = [
    ...MARKETS.crypto.slice(0, 8),
    ...MARKETS.forex.slice(0, 6),
    ...MARKETS.stocks.slice(0, 8),
    ...MARKETS.indices.slice(0, 6),
    ...MARKETS.bonds.slice(0, 4),
  ];
  function paint() {
    el.innerHTML = sample.map(i => {
      const cls = (Object.entries(MARKETS).find(([k, list]) => list.includes(i)) || [])[0] || 'crypto';
      const up = i.chg >= 0;
      const intensity = Math.min(1, Math.abs(i.chg) / 6);
      const bg = up
        ? `rgba(0, 255, 163, ${0.12 + intensity * 0.55})`
        : `rgba(255, 0, 60, ${0.12 + intensity * 0.55})`;
      return `
        <div class="heat-cell" style="background:${bg};" title="${i.name}">
          <div>
            <div class="hsym">${i.sym}</div>
            <div class="hprice">${fmtPrice(cls, i.price)}</div>
          </div>
          <div class="hpct ${up ? 'text-green' : 'text-red'}">${up ? '+' : ''}${i.chg.toFixed(2)}%</div>
        </div>
      `;
    }).join('');
  }
  paint();
  setInterval(() => { sample.forEach(tickPrice); paint(); }, 3000);
}

/* ---------- SCROLL REVEAL ---------- */
function bindScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

/* ---------- TICKER ---------- */
function buildTicker() {
  const el = document.getElementById('ticker');
  if (!el || typeof ALL_INSTRUMENTS === 'undefined') return;

  // Pick a representative sample across asset classes
  const sample = [
    ...MARKETS.crypto.slice(0, 5),
    ...MARKETS.forex.slice(0, 4),
    ...MARKETS.stocks.slice(0, 5),
    ...MARKETS.indices.slice(0, 4),
    ...MARKETS.bonds.slice(0, 3),
  ];
  const items = [...sample, ...sample]; // duplicate for seamless scroll

  el.innerHTML = items.map(i => {
    const up = i.chg >= 0;
    const arrow = up ? '▲' : '▼';
    const klass = up ? 'up' : 'down';
    const cls = (i.asset || guessAsset(i)) || 'crypto';
    const price = fmtPrice(cls, i.price);
    return `
      <span class="ticker-item">
        <span class="symbol">${i.sym}</span>
        <span class="text-dim" style="font-size:0.78rem;">${(cls).toUpperCase()}</span>
        <span>${price}</span>
        <span class="change ${klass}">${arrow} ${Math.abs(i.chg).toFixed(2)}%</span>
      </span>
    `;
  }).join('');
}
function guessAsset(i) {
  for (const [k, arr] of Object.entries(MARKETS)) if (arr.includes(i)) return k;
  return 'crypto';
}

/* ---------- COUNTERS ---------- */
function animateCounters() {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;

  const fmt = (n, prefix, suffix) => {
    let s;
    if (n >= 1e9) s = (n/1e9).toFixed(1) + 'B';
    else if (n >= 1e6) s = (n/1e6).toFixed(0) + 'M';
    else if (n >= 1e3) s = (n/1e3).toFixed(0) + 'k';
    else s = Math.round(n).toString();
    return (prefix||'') + s + (suffix||'');
  };

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const dur = 1600;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1-p, 3);
        el.textContent = fmt(target * eased, prefix, suffix);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.3 });
  els.forEach(el => obs.observe(el));
}

/* ---------- AUTH (localStorage demo) ---------- */
const AUTH_KEY = 'cv_user';
const ACCT_KEY = 'cv_account';

function getUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function setUser(u) { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); }
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'index.html';
}
function requireAuth() {
  if (!getUser()) {
    window.location.href = 'login.html';
    return null;
  }
  return getUser();
}

function getAccount() {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(ACCT_KEY)); } catch {}
  if (!a) {
    a = seedAccount();
    localStorage.setItem(ACCT_KEY, JSON.stringify(a));
  }
  // Migrate stale accounts that pre-date the multi-wallet model
  if (!a.wallets) {
    a.wallets = {
      main:    { balance: +(a.available || a.balance * 0.30).toFixed(2) },
      trading: { balance: +(a.invested  || a.balance * 0.70).toFixed(2) },
    };
  }
  if (!a.transfers) a.transfers = [];
  return a;
}
function setAccount(a) { localStorage.setItem(ACCT_KEY, JSON.stringify(a)); }

function seedAccount() {
  const now = Date.now();
  const startBalance = 10000;
  const trades = [];
  // Seed 30 historical trades across asset classes
  const samples = [
    ['BTC',  'crypto',  'BUY',  0.12,    65800,  67420,  +194.4],
    ['ETH',  'crypto',  'BUY',  3.5,     3120,   3247,   +444.5],
    ['EURUSD','forex',  'BUY',  10000,   1.0810, 1.0842, +32.0],
    ['AAPL', 'stocks',  'BUY',  20,      214.20, 218.42, +84.4],
    ['NVDA', 'stocks',  'BUY',  40,      138.40, 142.71, +172.4],
    ['SPX',  'indices', 'BUY',  1,       5810,   5847,   +37.0],
    ['SOL',  'crypto',  'SELL', 12,      182.40, 178.42, +47.8],
    ['GBPUSD','forex',  'SELL', 8000,    1.2754, 1.2731, +18.4],
    ['TSLA', 'stocks',  'BUY',  10,      330.10, 342.18, +120.8],
    ['NDX',  'indices', 'BUY',  1,       20680,  20847,  +167.0],
    ['DOGE', 'crypto',  'BUY',  5000,    0.1462, 0.1582, +60.0],
    ['USDJPY','forex',  'BUY',  10000,   156.10, 156.82, +46.2],
    ['MSFT', 'stocks',  'BUY',  8,       418.20, 421.84, +29.1],
    ['XRP',  'crypto',  'SELL', 4000,    0.5891, 0.5824, +26.8],
    ['BNB',  'crypto',  'BUY',  4,       604.20, 612.30, +32.4],
    ['DAX',  'indices', 'BUY',  1,       19284,  19421,  +137.0],
    ['ADA',  'crypto',  'BUY',  3000,    0.4421, 0.4621, +60.0],
    ['AMZN', 'stocks',  'BUY',  10,      192.10, 198.32, +62.2],
    ['GOOGL','stocks',  'BUY',  10,      174.20, 178.61, +44.1],
    ['AVAX', 'crypto',  'BUY',  20,      36.42,  38.92,  +50.0],
    ['FTSE', 'indices', 'SELL', 1,       8312,   8284,   +28.0],
    ['LINK', 'crypto',  'BUY',  50,      17.21,  18.47,  +63.0],
    ['META', 'stocks',  'SELL', 5,       572.40, 564.27, +40.6],
    ['NKY',  'indices', 'BUY',  1,       37840,  38247,  +407.0],
    ['EURUSD','forex',  'SELL', 5000,    1.0871, 1.0842, +14.5],
    ['DOT',  'crypto',  'SELL', 100,     7.42,   7.24,   +18.0],
    ['JPM',  'stocks',  'BUY',  10,      214.20, 218.94, +47.4],
    ['V',    'stocks',  'BUY',  10,      284.10, 287.42, +33.2],
    ['NZDUSD','forex',  'BUY',  10000,   0.5984, 0.6014, +30.0],
    ['BTC',  'crypto',  'SELL', 0.05,    66100,  67420, -66.0],
  ];

  samples.forEach((s, i) => {
    const [sym, asset, side, qty, entry, exit, pl] = s;
    trades.push({
      id: 'T' + (10000 + i),
      sym, asset, side, qty, entry, exit, pl,
      time: now - (i + 1) * (Math.random() * 4 + 1) * 60 * 60 * 1000,
      bot: i % 4 !== 0 ? 'Vault Alpha' : 'Macro Pro',
      status: 'CLOSED',
    });
  });

  // Holdings — current open positions
  const holdings = [
    { sym: 'BTC',  asset: 'crypto',  qty: 0.34,   avg: 64200,  value: 22923 },
    { sym: 'ETH',  asset: 'crypto',  qty: 4.2,    avg: 3010,   value: 13641 },
    { sym: 'SOL',  asset: 'crypto',  qty: 18,     avg: 162,    value: 3211 },
    { sym: 'AAPL', asset: 'stocks',  qty: 25,     avg: 210.40, value: 5460 },
    { sym: 'NVDA', asset: 'stocks',  qty: 30,     avg: 132.10, value: 4281 },
    { sym: 'EURUSD',asset: 'forex',  qty: 50000,  avg: 1.0810, value: 54210 },
    { sym: 'SPX',  asset: 'indices', qty: 2,      avg: 5780,   value: 11694 },
    { sym: 'US10Y',asset: 'bonds',   qty: 50,     avg: 4.18,   value: 5210 },
  ];

  // Build 60 days of equity curve
  const equity = [];
  let v = startBalance;
  for (let d = 60; d >= 0; d--) {
    const drift = 0.004 + (Math.random() - 0.42) * 0.02;
    v = v * (1 + drift);
    equity.push({ t: now - d * 24 * 3600 * 1000, v: Math.round(v * 100) / 100 });
  }
  const balance = Math.round(equity[equity.length - 1].v * 100) / 100;

  return {
    balance,
    available: Math.round(balance * 0.35 * 100) / 100,
    invested: Math.round(balance * 0.65 * 100) / 100,
    // Multi-wallet model:
    //   main    — funding/withdrawal wallet (cash you can pull out)
    //   trading — capital deployed to AI bots / open positions
    wallets: {
      main:    { balance: Math.round(balance * 0.30 * 100) / 100 },
      trading: { balance: Math.round(balance * 0.70 * 100) / 100 },
    },
    pnlAllTime: Math.round((balance - startBalance) * 100) / 100,
    pnl30d: Math.round(balance * 0.184 * 100) / 100,
    winRate: 84,
    trades,
    holdings,
    equity,
    transfers: [
      { id: 'X3001', from: 'main', to: 'trading', amount: 5000, time: now - 40 * 86400000 },
      { id: 'X3002', from: 'main', to: 'trading', amount: 3000, time: now - 22 * 86400000 },
      { id: 'X3003', from: 'trading', to: 'main', amount: 1200, time: now -  8 * 86400000 },
    ],
    deposits: [
      { id: 'D1001', amount: 5000, method: 'Wire',  status: 'COMPLETED', time: now - 50 * 86400000 },
      { id: 'D1002', amount: 3000, method: 'Card',  status: 'COMPLETED', time: now - 30 * 86400000 },
      { id: 'D1003', amount: 2000, method: 'BTC',   status: 'COMPLETED', time: now - 12 * 86400000 },
    ],
    withdrawals: [
      { id: 'W2001', amount: 800, method: 'Bank', status: 'COMPLETED', time: now - 18 * 86400000 },
    ],
  };
}

/* ---------- AUTH UI REFLECTION ---------- */
function reflectAuthState() {
  const u = getUser();
  document.querySelectorAll('[data-auth=in]').forEach(el => el.classList.toggle('hidden', !u));
  document.querySelectorAll('[data-auth=out]').forEach(el => el.classList.toggle('hidden', !!u));
  if (u) {
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = u.name || u.email.split('@')[0]);
    document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = u.email);
    document.querySelectorAll('[data-user-initials]').forEach(el => {
      const n = (u.name || u.email).split(/[\s.@]/).filter(Boolean);
      el.textContent = (n[0]?.[0] || '') + (n[1]?.[0] || '');
      el.style.textTransform = 'uppercase';
    });
  }
}

/* ---------- TOASTS ---------- */
function toast(msg, type = 'success') {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.className = 'toast ' + type;
  t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> ${msg}`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- LIVE PRICE TICK SIMULATION ---------- */
// returns updated price for a given instrument (random walk)
function tickPrice(inst) {
  const vol = inst.asset === 'crypto'  ? 0.0025
            : inst.asset === 'forex'   ? 0.0004
            : inst.asset === 'stocks'  ? 0.0015
            : inst.asset === 'indices' ? 0.0010
            : inst.asset === 'futures' ? 0.0030
            : 0.0005;
  const drift = (Math.random() - 0.5) * vol;
  inst.price = +(inst.price * (1 + drift)).toFixed(inst.asset === 'forex' ? 5 : 2);
  inst.chg = +(inst.chg + (Math.random() - 0.5) * 0.05).toFixed(2);
  return inst;
}



/* =========================================================
   PAYOUT BAR (in-app strip on dashboard / trading / markets)
   + landing-page Live Payouts feed + ROI calculator + FAQ
   ========================================================= */

const PB_NAMES = [
  ['Sarah','London,UK'],['Marcus','Austin,TX'],['Aisha','Dubai,UAE'],['Hiroshi','Tokyo,JP'],
  ['Lukas','Berlin,DE'],['Olivia','Sydney,AU'],['Mateo','Madrid,ES'],['Priya','Mumbai,IN'],
  ['Chen','Shanghai,CN'],['Eva','Stockholm,SE'],['Diego','Mexico City,MX'],['Noah','Toronto,CA'],
  ['Emma','Paris,FR'],['Lars','Oslo,NO'],['Yusuf','Istanbul,TR'],['Ananya','Bangalore,IN'],
  ['Liam','Dublin,IE'],['Mia','Auckland,NZ'],['Carlos','São Paulo,BR'],['Zoe','Cape Town,ZA'],
];
function pbInitials(name){ return name.slice(0,1).toUpperCase(); }
function pbAmount() {
  // Realistic spread of withdrawals, biased to mid-sized
  const r = Math.random();
  if (r < 0.55) return Math.round((200 + Math.random() * 1800) / 10) * 10;
  if (r < 0.85) return Math.round((2000 + Math.random() * 6000) / 50) * 50;
  if (r < 0.97) return Math.round((8000 + Math.random() * 18000) / 100) * 100;
  return Math.round((25000 + Math.random() * 75000) / 500) * 500;
}
function pbAgo() {
  const m = Math.floor(Math.random() * 12) + 1;
  return m === 1 ? 'just now' : m + 'm ago';
}
function pbItems(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [name, city] = PB_NAMES[Math.floor(Math.random() * PB_NAMES.length)];
    out.push({ name, city, amt: pbAmount(), ago: pbAgo() });
  }
  return out;
}

/* In-app top strip — renders into [data-payout-bar] containers */
function buildPayoutBar() {
  document.querySelectorAll('[data-payout-bar]').forEach(host => {
    const items = pbItems(14);
    const total = 1840000 + Math.floor(Math.random() * 60000);
    const itemHtml = items.map(it => `
      <span class="pb-item">
        <span class="pb-icon"><i class="fa-solid fa-arrow-up"></i></span>
        <span class="pb-who">${it.name}</span>
        <span class="text-mute">from</span>
        <span>${it.city}</span>
        <span class="text-mute">·</span>
        <span>just withdrew</span>
        <span class="pb-amt">$${it.amt.toLocaleString()}</span>
        <span class="text-mute">${it.ago}</span>
      </span>
    `).join('');
    host.innerHTML = `
      <div class="pb-label"><span class="dot"></span> Live payouts</div>
      <div class="pb-track"><div class="pb-row">${itemHtml}${itemHtml}</div></div>
      <div class="pb-total"><i class="fa-solid fa-shield"></i> <strong>$${total.toLocaleString()}</strong> paid · 24h</div>
    `;
  });
}

/* Landing-page payouts feed — pushes a new row every few seconds */
function buildLandingPayouts() {
  const feed = document.getElementById('payoutsFeed');
  const counter = document.getElementById('payoutsCounter');
  if (!feed || !counter) return;

  let total = 1842317;
  const seed = pbItems(6);
  feed.innerHTML = seed.map(rowHtml).join('');
  paintCounter();

  setInterval(() => {
    const it = pbItems(1)[0];
    total += it.amt;
    paintCounter();
    const div = document.createElement('div');
    div.innerHTML = rowHtml(it);
    feed.insertBefore(div.firstElementChild, feed.firstChild);
    while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }, 4200);

  function paintCounter() {
    counter.textContent = '$' + total.toLocaleString();
  }
  function rowHtml(it) {
    return `
      <div class="payout-row">
        <div class="pa-avatar">${pbInitials(it.name)}</div>
        <div>
          <div class="pa-who">${it.name} <span class="text-mute" style="font-weight:400;">from ${it.city}</span></div>
          <div class="pa-meta">Withdrew to bank · ${it.ago}</div>
        </div>
        <div class="pa-amt">+$${it.amt.toLocaleString()}</div>
      </div>
    `;
  }
}

/* Returns calculator — projects compounded value across risk profiles */
function buildCalculator() {
  const root = document.getElementById('roiCalc');
  if (!root) return;
  const PROFILES = {
    conservative: { name: 'Conservative', monthly: 0.0085, yearly: 0.10 }, // ~10% APY
    balanced:     { name: 'Balanced',     monthly: 0.0165, yearly: 0.20 }, // ~20% APY
    aggressive:   { name: 'Aggressive',   monthly: 0.0245, yearly: 0.30 }, // ~30% APY
  };
  let profile = 'balanced';
  const $ = sel => root.querySelector(sel);

  function fmtCash(n) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
  function recalc() {
    const amt = Math.max(50, parseFloat($('#calcAmt').value || 0));
    const months = parseInt($('#calcMonths').value, 10);
    const r = PROFILES[profile].monthly;
    const fv = amt * Math.pow(1 + r, months);
    const profit = fv - amt;
    const pct = ((fv / amt) - 1) * 100;
    $('#calcResult').textContent = fmtCash(fv);
    $('#calcDelta').textContent = '+' + fmtCash(profit) + '  (+' + pct.toFixed(1) + '%)';
    $('#calcMonthsOut').textContent = months + ' month' + (months === 1 ? '' : 's');
    $('#calcAmtOut').textContent = fmtCash(amt);
    $('#calcProfile').textContent = PROFILES[profile].name;
    $('#calcApy').textContent = (PROFILES[profile].yearly * 100).toFixed(0) + '% APY target';
    // visual fill on the slider
    const r1 = $('#calcMonths');
    const pct2 = ((months - +r1.min) / (+r1.max - +r1.min)) * 100;
    r1.style.setProperty('--p', pct2 + '%');
  }
  root.querySelectorAll('.calc-profiles button').forEach(b => {
    b.addEventListener('click', () => {
      profile = b.dataset.profile;
      root.querySelectorAll('.calc-profiles button').forEach(x => x.classList.toggle('active', x === b));
      recalc();
    });
  });
  $('#calcAmt').addEventListener('input', recalc);
  $('#calcMonths').addEventListener('input', recalc);
  recalc();
}

/* FAQ accordion */
function buildFaq() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      // close others (single-open accordion)
      document.querySelectorAll('.faq-item.open').forEach(x => { if (x !== item) x.classList.remove('open'); });
      item.classList.toggle('open');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  buildPayoutBar();
  buildLandingPayouts();
  buildCalculator();
  buildFaq();
});
