/* Node test runner for the algo engine.
 * Loads js/data.js + js/algo.js into a sandboxed `vm`, then runs
 * backtests for all bot presets and prints metrics.
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

const { backtest, tuneBot, createBot } = sandbox;

const SYMBOLS = ['BTC','ETH','SOL','EURUSD','GBPUSD','AAPL','NVDA','TSLA','SPX','NDX'];
const BARS = 1500;
const RUNS = 5;

function avgRun(name) {
  const totals = { winRate: 0, rr: 0, profitFactor: 0, expectancy: 0, netPnl: 0, total: 0 };
  for (let r = 0; r < RUNS; r++) {
    const m = backtest(name, SYMBOLS, BARS);
    for (const k of Object.keys(totals)) totals[k] += m[k] || 0;
  }
  for (const k of Object.keys(totals)) totals[k] = +(totals[k] / RUNS).toFixed(2);
  return totals;
}

const presets = ['Vault Alpha', 'Scalper X', 'Intraday Pro', 'Macro Pro', 'Mean Reverter', 'Breakout Pro', 'Smart Money'];

console.log('='.repeat(78));
console.log('ALGO BACKTEST · ' + RUNS + ' runs of ' + BARS + ' bars · ' + SYMBOLS.length + ' instruments');
console.log('='.repeat(78));
console.log('Bot              | Trades |  Win%  |  R:R  |  PF   | Expectancy |   NetPnL');
console.log('-'.repeat(78));
for (const name of presets) {
  const m = avgRun(name);
  console.log(
    name.padEnd(17) + '| ' +
    String(m.total).padStart(6) + ' | ' +
    String(m.winRate).padStart(5) + '% | ' +
    String(m.rr).padStart(4) + ':1| ' +
    String(m.profitFactor).padStart(5) + ' | ' +
    String('$' + m.expectancy).padStart(10) + ' | ' +
    String((m.netPnl >= 0 ? '+$' : '-$') + Math.abs(m.netPnl)).padStart(9)
  );
}
console.log('='.repeat(78));
