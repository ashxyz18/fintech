/* MasterAI multi-regime test — single unified bot, all market conditions. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console, performance: { now: () => Date.now() }, Math, Date, Object };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/algo.js'), 'utf8'), sandbox);
const { createBot, simulateFlow, MARKETS } = sandbox;

const SYMS = ['BTC','ETH','EURUSD','AAPL','SPX'];
const BARS = 800;
const RUNS = 4;

function rng(seed) { let s = seed | 0 || 1; return () => { s = (s * 1103515245 + 12345) | 0; return ((s >>> 16) & 0x7fff) / 0x7fff; }; }
const REGIMES = {
  StrongUp:   (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; for (let i=0;i<b;i++){ p *= 1+0.0025+(r()-0.5)*0.012; o.push({price:p, volume:r()*800+200});} return o; },
  StrongDown: (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; for (let i=0;i<b;i++){ p *= 1-0.0025+(r()-0.5)*0.012; o.push({price:p, volume:r()*800+200});} return o; },
  Range:      (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; for (let i=0;i<b;i++){ p += (p0-p)*0.04 + (r()-0.5)*p*0.012; o.push({price:p, volume:r()*800+200});} return o; },
  Chop:       (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; for (let i=0;i<b;i++){ p *= 1+(r()-0.5)*0.022; o.push({price:p, volume:r()*800+200});} return o; },
  Shock:      (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; for (let i=0;i<b;i++){ let m=(r()-0.5)*0.012; if (r()<0.005) m += (r()<0.5?-1:1)*0.04; p*=1+m; o.push({price:p, volume:r()*800+200+(Math.abs(m)>0.02?2000:0)});} return o; },
  Mixed:      (b, p0, sd) => { const r = rng(sd); let p = p0; const o = []; let rb=0, m=0; for (let i=0;i<b;i++){ if (rb<=0){rb=80+Math.floor(r()*100); m=Math.floor(r()*4);} let mv; if (m===0) mv=0.0022+(r()-0.5)*0.012; else if (m===1) mv=-0.0022+(r()-0.5)*0.012; else if (m===2) mv=(p0-p)*0.04/p+(r()-0.5)*0.010; else mv=(r()-0.5)*0.020; p*=1+mv; o.push({price:p, volume:r()*800+200}); rb--;} return o; },
};

function guessAssetClass(sym) {
  for (const [cls, list] of Object.entries(MARKETS||{})) if (list.some(i => i.sym === sym)) return cls;
  return 'crypto';
}
function runRegime(fn, runs) {
  const totals = { winRate: 0, rr: 0, profitFactor: 0, expectancy: 0, netPnl: 0, total: 0 };
  for (let r = 0; r < runs; r++) {
    const bot = createBot();
    bot.equity = 10000; bot.startEquity = 10000;
    const series = {};
    SYMS.forEach((sym, ix) => series[sym] = fn(BARS, 100, (r * 31 + ix * 7) | 0));
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

console.log('='.repeat(96));
console.log('MASTER AI · single unified bot · ' + RUNS + ' runs × ' + BARS + ' bars × ' + SYMS.length + ' instruments');
console.log('='.repeat(96));
console.log('Regime         | Trades | Win%   | R:R   | PF    | Expectancy | Net PnL');
console.log('-'.repeat(96));
let totals = { netPnl: 0, profitable: 0, count: 0 };
for (const [name, fn] of Object.entries(REGIMES)) {
  const m = runRegime(fn, RUNS);
  totals.netPnl += m.netPnl; totals.count++;
  if (m.netPnl > 0) totals.profitable++;
  console.log(
    name.padEnd(15) + '| ' +
    String(m.total).padStart(6) + ' | ' +
    String(m.winRate).padStart(5) + '% | ' +
    String(m.rr).padStart(4) + ':1| ' +
    String(m.profitFactor).padStart(5) + ' | ' +
    ('$' + m.expectancy).padStart(10) + ' | ' +
    ((m.netPnl >= 0 ? '+$' : '-$') + Math.abs(m.netPnl)).padStart(8)
  );
}
console.log('='.repeat(96));
console.log('AGGREGATE: ' + totals.profitable + '/' + totals.count + ' regimes profitable · Total Net: ' + (totals.netPnl >= 0 ? '+$' : '-$') + Math.abs(totals.netPnl.toFixed(2)));
