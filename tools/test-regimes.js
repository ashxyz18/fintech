/* Multi-regime backtest harness.
 * Generates synthetic price series with explicit regime types and runs every bot
 * against each one. Shows where each strategy excels / struggles.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataSrc = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const algoSrc = fs.readFileSync(path.join(root, 'js/algo.js'), 'utf8');

const sandbox = { console, performance: { now: () => Date.now() }, Math, Date, Object };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);
vm.runInContext(algoSrc, sandbox);
const { createBot, simulateFlow } = sandbox;

const BOTS = ['Vault Alpha', 'Scalper X', 'Intraday Pro', 'Macro Pro', 'Mean Reverter', 'Breakout Pro', 'Smart Money'];
const SYMS = ['BTC','ETH','EURUSD','AAPL','SPX'];
const BARS = 600;
const RUNS = 3;

/* ---------------- REGIME GENERATORS ---------------- */
function rng(seed) {
  let s = seed | 0 || 1;
  return () => { s = (s * 1103515245 + 12345) | 0; return ((s >>> 16) & 0x7fff) / 0x7fff; };
}

function genStrongUp(bars, p0 = 100, seed = 1) {
  const r = rng(seed);
  let p = p0; const out = [];
  for (let i = 0; i < bars; i++) {
    p *= 1 + 0.0025 + (r() - 0.5) * 0.012;
    out.push({ price: p, volume: r() * 800 + 200 });
  }
  return out;
}
function genStrongDown(bars, p0 = 100, seed = 2) {
  const r = rng(seed);
  let p = p0; const out = [];
  for (let i = 0; i < bars; i++) {
    p *= 1 - 0.0025 + (r() - 0.5) * 0.012;
    out.push({ price: p, volume: r() * 800 + 200 });
  }
  return out;
}
function genRange(bars, p0 = 100, seed = 3) {
  const r = rng(seed);
  let p = p0; const out = [];
  const center = p0;
  for (let i = 0; i < bars; i++) {
    const pull = (center - p) * 0.04;
    p += pull + (r() - 0.5) * p * 0.012;
    out.push({ price: p, volume: r() * 800 + 200 });
  }
  return out;
}
function genChop(bars, p0 = 100, seed = 4) {
  const r = rng(seed);
  let p = p0; const out = [];
  for (let i = 0; i < bars; i++) {
    p *= 1 + (r() - 0.5) * 0.022;   // pure noise, no trend
    out.push({ price: p, volume: r() * 800 + 200 });
  }
  return out;
}
function genShock(bars, p0 = 100, seed = 5) {
  const r = rng(seed);
  let p = p0; const out = [];
  for (let i = 0; i < bars; i++) {
    let move = (r() - 0.5) * 0.012;
    if (r() < 0.005) move += (r() < 0.5 ? -1 : 1) * 0.04; // 0.5% chance of 4% shock
    p *= 1 + move;
    out.push({ price: p, volume: r() * 800 + 200 + (Math.abs(move) > 0.02 ? 2000 : 0) });
  }
  return out;
}
function genMixed(bars, p0 = 100, seed = 6) {
  // alternating regimes — like real markets
  const r = rng(seed);
  let p = p0; const out = [];
  let regimeBars = 0, mode = 0;
  for (let i = 0; i < bars; i++) {
    if (regimeBars <= 0) {
      regimeBars = 80 + Math.floor(r() * 100);
      mode = Math.floor(r() * 4); // 0=up, 1=down, 2=range, 3=chop
    }
    let move;
    if (mode === 0) move = 0.0022 + (r() - 0.5) * 0.012;
    else if (mode === 1) move = -0.0022 + (r() - 0.5) * 0.012;
    else if (mode === 2) move = (p0 - p) * 0.04 / p + (r() - 0.5) * 0.010;
    else move = (r() - 0.5) * 0.020;
    p *= 1 + move;
    out.push({ price: p, volume: r() * 800 + 200 });
    regimeBars--;
  }
  return out;
}

const REGIMES = {
  'StrongUp':   genStrongUp,
  'StrongDown': genStrongDown,
  'Range':      genRange,
  'Chop':       genChop,
  'Shock':      genShock,
  'Mixed':      genMixed,
};

/* ---------------- RUNNER ---------------- */
function guessAssetClass(sym) {
  for (const [cls, list] of Object.entries(sandbox.MARKETS || {})) {
    if (list.some(i => i.sym === sym)) return cls;
  }
  return 'crypto';
}

function runRegime(botName, regimeFn, runs) {
  const totals = { winRate: 0, rr: 0, profitFactor: 0, expectancy: 0, netPnl: 0, total: 0 };
  for (let r = 0; r < runs; r++) {
    const bot = createBot(botName);
    bot.equity = 10000; bot.startEquity = 10000;
    const series = {};
    SYMS.forEach((sym, ix) => series[sym] = regimeFn(BARS, 100, (r * 31 + ix * 7) | 0));
    for (let t = 0; t < BARS; t++) {
      const universe = SYMS.map(sym => ({ sym, asset: guessAssetClass(sym), price: series[sym][t].price }));
      const ctx = {
        volumes: Object.fromEntries(SYMS.map(s => [s, series[s][t].volume])),
        flow:    Object.fromEntries(SYMS.map(s => [s, simulateFlow({ sym: s })])),
      };
      bot.step(universe, ctx);
    }
    const m = bot.metrics();
    for (const k of Object.keys(totals)) totals[k] += m[k] || 0;
  }
  for (const k of Object.keys(totals)) totals[k] = +(totals[k] / runs).toFixed(2);
  return totals;
}

const out = {};
for (const bot of BOTS) {
  out[bot] = {};
  for (const [rName, fn] of Object.entries(REGIMES)) {
    out[bot][rName] = runRegime(bot, fn, RUNS);
  }
}

// Pretty print
console.log('=' .repeat(110));
console.log('MULTI-REGIME BACKTEST · ' + RUNS + ' runs × ' + BARS + ' bars · ' + SYMS.length + ' instruments');
console.log('=' .repeat(110));

const regimes = Object.keys(REGIMES);
const head = 'Bot              ' + regimes.map(r => r.padStart(15)).join('');
console.log(head);
console.log('-'.repeat(110));

for (const bot of BOTS) {
  // Win % line
  let line = bot.padEnd(17);
  for (const rg of regimes) {
    const m = out[bot][rg];
    const profitable = m.netPnl >= 0;
    const cell = `${m.winRate.toFixed(1)}% · ${profitable ? '+' : ''}$${m.netPnl}`;
    line += cell.padStart(15);
  }
  console.log(line);
}
console.log('=' .repeat(110));

// Aggregate score per bot
console.log('\nAGGREGATE (across all regimes):');
console.log('-'.repeat(72));
console.log('Bot              | Profitable regimes | Total NetPnL | Avg WinRate');
console.log('-'.repeat(72));
for (const bot of BOTS) {
  const rs = Object.values(out[bot]);
  const profitable = rs.filter(r => r.netPnl > 0).length;
  const totalNet = rs.reduce((a, b) => a + b.netPnl, 0);
  const avgWin = rs.reduce((a, b) => a + b.winRate, 0) / rs.length;
  console.log(
    bot.padEnd(17) + '| ' +
    (profitable + '/' + rs.length).padStart(18) + ' | ' +
    ((totalNet >= 0 ? '+$' : '-$') + Math.abs(totalNet.toFixed(2))).padStart(12) + ' | ' +
    avgWin.toFixed(1).padStart(11) + '%'
  );
}
console.log('=' .repeat(72));
