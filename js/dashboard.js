/* =========================================================
   CRYPTOVAULT - DASHBOARD LOGIC
   - Auth gate
   - Renders balance, KPIs, equity chart, allocation chart
   - Holdings + trade history with asset-class filters
   - Quick trade form
   - Live algo bot ticking → injects new trades
   ========================================================= */

const user = requireAuth();          // redirect to login if missing
const account = getAccount();        // seeded demo data

/* ---------- HEADER / KPIs ---------- */
document.getElementById('totalBalance').textContent  = fmtMoney(account.balance);
document.getElementById('mainWallet').textContent    = fmtMoney(account.wallets.main.balance);
document.getElementById('tradingWallet').textContent = fmtMoney(account.wallets.trading.balance);
document.getElementById('allTimePnl').textContent    = '+' + fmtMoney(account.pnlAllTime);
document.getElementById('pnl30d').textContent        = '+' + fmtMoney(account.pnl30d);
document.getElementById('winRate').textContent       = account.winRate + '%';
document.getElementById('openPos').textContent       = account.holdings.length;

const todayPlVal = +(account.balance * (Math.random() * 0.012 + 0.002)).toFixed(2);
document.getElementById('todayPnl').textContent      = '+' + fmtMoney(todayPlVal);
document.getElementById('todayPnlPct').textContent   = '+' + ((todayPlVal/account.balance)*100).toFixed(2) + '%';
document.getElementById('todayTrades').textContent   = (Math.floor(Math.random() * 18) + 6).toString();

/* ---------- EQUITY CHART ---------- */
const ctx = document.getElementById('equityChart').getContext('2d');
const grad = ctx.createLinearGradient(0, 0, 0, 300);
grad.addColorStop(0, 'rgba(0, 162, 255, 0.45)');
grad.addColorStop(0.5, 'rgba(31, 109, 255, 0.18)');
grad.addColorStop(1, 'rgba(31, 109, 255, 0)');

const equityChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: account.equity.map(p => new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Equity',
      data: account.equity.map(p => p.v),
      borderColor: '#00a2ff',
      backgroundColor: grad,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#00a2ff',
      pointHoverBorderWidth: 2,
      borderWidth: 2.5,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f1422',
        borderColor: 'rgba(0, 162, 255, 0.25)',
        borderWidth: 1,
        titleColor: '#9aa3b8',
        bodyColor: '#fff',
        padding: 12,
        callbacks: {
          label: c => '  Equity: ' + fmtMoney(c.parsed.y),
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#5f6883', maxTicksLimit: 8 }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#5f6883',
          callback: v => '$' + (v/1000).toFixed(0) + 'k'
        }
      }
    }
  }
});

document.getElementById('rangeTabs').addEventListener('click', e => {
  const btn = e.target.closest('[data-range]');
  if (!btn) return;
  document.querySelectorAll('#rangeTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const r = btn.dataset.range;
  let n = account.equity.length;
  if (r === '1D') n = 1;
  else if (r === '1W') n = 7;
  else if (r === '1M') n = 30;
  else if (r === '3M') n = Math.min(account.equity.length, 90);
  const slice = account.equity.slice(-n);
  equityChart.data.labels = slice.map(p => new Date(p.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  equityChart.data.datasets[0].data = slice.map(p => p.v);
  equityChart.update();
});

/* ---------- ALLOCATION CHART ---------- */
function buildAllocation() {
  const totals = { crypto: 0, forex: 0, stocks: 0, indices: 0, bonds: 0 };
  account.holdings.forEach(h => totals[h.asset] += h.value);
  return totals;
}
const alloc = buildAllocation();
const allocColors = { crypto: '#ff2a4d', forex: '#1f6dff', stocks: '#00ffa3', indices: '#ffb800', bonds: '#00e5ff' };
const allocLabels = Object.keys(alloc);

new Chart(document.getElementById('allocChart'), {
  type: 'doughnut',
  data: {
    labels: allocLabels,
    datasets: [{
      data: allocLabels.map(l => alloc[l]),
      backgroundColor: allocLabels.map(l => allocColors[l]),
      borderColor: '#0f1422',
      borderWidth: 3,
      hoverOffset: 8,
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: c => `  ${c.label}: ${fmtMoney(c.parsed)}` }
      }
    }
  }
});

const totalAlloc = Object.values(alloc).reduce((a,b)=>a+b,0);
document.getElementById('allocLegend').innerHTML = allocLabels.map(l => `
  <div style="display:flex; align-items:center; gap:10px;">
    <span style="width:10px; height:10px; border-radius:50%; background:${allocColors[l]};"></span>
    <span style="flex:1; text-transform:capitalize;">${l}</span>
    <span class="text-dim">${((alloc[l]/totalAlloc)*100).toFixed(1)}%</span>
    <strong style="min-width:80px; text-align:right;">${fmtMoney(alloc[l])}</strong>
  </div>
`).join('');

/* ---------- HOLDINGS LIST ---------- */
function renderHoldings(filter = 'all') {
  const root = document.getElementById('holdingsList');
  const list = filter === 'all' ? account.holdings : account.holdings.filter(h => h.asset === filter);
  if (!list.length) {
    root.innerHTML = `<div class="text-dim text-center" style="padding:30px;">No positions in this asset class.</div>`;
    return;
  }
  root.innerHTML = list.map(h => {
    const inst = ALL_INSTRUMENTS.find(i => i.sym === h.sym);
    const live = inst ? inst.price : h.avg;
    const value = h.qty * live;
    const change = ((live - h.avg) / h.avg) * 100;
    const up = change >= 0;
    return `
      <div class="asset">
        <div class="coin-icon ${inst?.iconClass || ''}" style="background:${allocColors[h.asset]};">${(inst?.icon || h.sym[0])}</div>
        <div>
          <div class="name">${h.sym} <span class="text-mute" style="font-size:0.78rem; text-transform:uppercase;">${h.asset}</span></div>
          <div class="amt">${h.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ avg ${fmtPrice(h.asset, h.avg)}</div>
        </div>
        <div>
          <div class="value">${fmtMoney(value)}</div>
          <div class="change ${up ? 'text-green' : 'text-red'}">${up?'+':''}${change.toFixed(2)}%</div>
        </div>
      </div>
    `;
  }).join('');
}
renderHoldings();
document.getElementById('holdingFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-cls]'); if (!btn) return;
  document.querySelectorAll('#holdingFilters button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHoldings(btn.dataset.cls);
});

/* ---------- TRADE HISTORY ---------- */
function renderTrades(filter = 'all') {
  const tbody = document.querySelector('#tradesTable tbody');
  const list = (filter === 'all' ? account.trades : account.trades.filter(t => t.asset === filter))
    .slice().sort((a,b) => b.time - a.time);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px;" class="text-dim">No trades yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(t => {
    const up = t.pl >= 0;
    return `
      <tr>
        <td class="text-dim">${new Date(t.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
        <td><span class="tag" style="background:${allocColors[t.asset]}22; color:${allocColors[t.asset]};">${t.asset.toUpperCase()}</span></td>
        <td><strong>${t.sym}</strong></td>
        <td><span class="tag ${t.side === 'BUY' ? 'tag-buy' : 'tag-sell'}">${t.side}</span></td>
        <td>${t.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
        <td>${fmtPrice(t.asset, t.entry)}</td>
        <td>${fmtPrice(t.asset, t.exit)}</td>
        <td class="${up ? 'text-green' : 'text-red'}"><strong>${up?'+':''}${fmtMoney(t.pl)}</strong></td>
        <td class="text-dim">${t.bot}</td>
        <td>${t.status === 'CLOSED' ? '<span class="tag tag-buy">CLOSED</span>' : '<span class="tag tag-pending">OPEN</span>'}</td>
      </tr>
    `;
  }).join('');
}
renderTrades();
document.getElementById('tradeFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-cls]'); if (!btn) return;
  document.querySelectorAll('#tradeFilters button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTrades(btn.dataset.cls);
});

/* ---------- DEPOSITS / WITHDRAWALS ---------- */
function renderTxList(elId, list, isDeposit) {
  const el = document.getElementById(elId);
  if (!list.length) { el.innerHTML = `<div class="text-dim text-center" style="padding:30px;">No ${isDeposit?'deposits':'withdrawals'} yet.</div>`; return; }
  el.innerHTML = list.slice(-5).reverse().map(t => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom: 1px solid var(--border);">
      <div>
        <div style="font-weight:600;">${isDeposit?'+':''}${isDeposit?'':'-'}${fmtMoney(t.amount)} <span class="text-dim" style="font-weight:400; font-size:0.85rem;">via ${t.method}</span></div>
        <div class="text-mute" style="font-size:0.78rem;">${new Date(t.time).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })} · ${t.id}</div>
      </div>
      <span class="tag ${t.status === 'COMPLETED' ? 'tag-buy' : 'tag-pending'}">${t.status}</span>
    </div>
  `).join('');
}
renderTxList('depositsList', account.deposits, true);
renderTxList('withdrawalsList', account.withdrawals, false);

/* ---------- QUICK TRADE FORM ---------- */
const qtSym = document.getElementById('qtSym');
qtSym.innerHTML = Object.entries(MARKETS).map(([cls, arr]) => `
  <optgroup label="${cls.toUpperCase()}">
    ${arr.map(i => `<option value="${i.sym}|${cls}">${i.sym} — ${i.name}</option>`).join('')}
  </optgroup>
`).join('');

function placeOrder(side) {
  const [sym, asset] = qtSym.value.split('|');
  const amt = parseFloat(document.getElementById('qtAmt').value);
  if (!amt || amt < 10) { toast('Minimum order is $10', 'error'); return; }
  if (side === 'BUY' && amt > account.wallets.trading.balance) {
    toast('Trading wallet too low. Transfer from main first.', 'error');
    return;
  }

  const inst = MARKETS[asset].find(i => i.sym === sym);
  const qty = amt / inst.price;
  const trade = {
    id: 'T' + Date.now(),
    sym, asset, side, qty,
    entry: inst.price, exit: inst.price,
    pl: 0,
    time: Date.now(),
    bot: 'Manual',
    status: 'OPEN',
  };
  account.trades.unshift(trade);

  if (side === 'BUY') {
    account.wallets.trading.balance = +(account.wallets.trading.balance - amt).toFixed(2);
    const existing = account.holdings.find(h => h.sym === sym);
    if (existing) {
      const newQty = existing.qty + qty;
      existing.avg = (existing.avg * existing.qty + inst.price * qty) / newQty;
      existing.qty = newQty;
      existing.value = newQty * inst.price;
    } else {
      account.holdings.push({ sym, asset, qty, avg: inst.price, value: amt });
    }
  } else {
    account.wallets.trading.balance = +(account.wallets.trading.balance + amt).toFixed(2);
  }
  setAccount(account);
  toast(`${side} order for ${sym} executed at ${fmtPrice(asset, inst.price)}`);
  renderTrades();
  renderHoldings();
  document.getElementById('mainWallet').textContent    = fmtMoney(account.wallets.main.balance);
  document.getElementById('tradingWallet').textContent = fmtMoney(account.wallets.trading.balance);
}

/* ---------- TRANSFER MODAL ---------- */
let transferDir = { from: 'main', to: 'trading' };
function openTransferModal() {
  document.getElementById('transferModal').classList.remove('hidden');
  paintTransferUI();
}
function closeTransferModal() {
  document.getElementById('transferModal').classList.add('hidden');
}
function swapWallets() {
  transferDir = { from: transferDir.to, to: transferDir.from };
  paintTransferUI();
}
function paintTransferUI() {
  document.getElementById('fromWalletName').textContent = transferDir.from === 'main' ? 'Main wallet' : 'Trading wallet';
  document.getElementById('toWalletName').textContent   = transferDir.to   === 'main' ? 'Main wallet' : 'Trading wallet';
  document.getElementById('fromWalletBal').textContent  = fmtMoney(account.wallets[transferDir.from].balance);
  document.getElementById('toWalletBal').textContent    = fmtMoney(account.wallets[transferDir.to].balance);
}
function setTransferPct(p) {
  const max = account.wallets[transferDir.from].balance;
  document.getElementById('transferAmt').value = (max * p).toFixed(2);
}
function doTransfer() {
  const amt = parseFloat(document.getElementById('transferAmt').value);
  if (!amt || amt < 10) return toast('Minimum transfer is $10', 'error');
  const from = account.wallets[transferDir.from];
  if (amt > from.balance) return toast('Insufficient balance in ' + transferDir.from + ' wallet.', 'error');

  account.wallets[transferDir.from].balance = +(account.wallets[transferDir.from].balance - amt).toFixed(2);
  account.wallets[transferDir.to].balance   = +(account.wallets[transferDir.to].balance + amt).toFixed(2);
  account.transfers.unshift({
    id: 'X' + Date.now(),
    from: transferDir.from, to: transferDir.to,
    amount: amt, time: Date.now(),
  });
  setAccount(account);
  document.getElementById('mainWallet').textContent    = fmtMoney(account.wallets.main.balance);
  document.getElementById('tradingWallet').textContent = fmtMoney(account.wallets.trading.balance);
  toast(`Transferred ${fmtMoney(amt)} from ${transferDir.from} → ${transferDir.to}`);
  closeTransferModal();
  document.getElementById('transferAmt').value = '';
}

/* ---------- LIVE ALGO BOT INJECTION ---------- */
// Tick prices and let bots take a few real decisions per minute, injected into the trade history.
const liveBot = createBot('Vault Alpha');
liveBot.equity = account.balance;
const universe = [
  ...MARKETS.crypto.slice(0, 6),
  ...MARKETS.forex.slice(0, 4),
  ...MARKETS.stocks.slice(0, 5),
  ...MARKETS.indices.slice(0, 3),
];
// Pre-warm the bot with synthetic history so it can produce signals quickly
universe.forEach(inst => {
  for (let i = 0; i < 60; i++) {
    const noisy = inst.price * (1 + (Math.random()-0.5) * 0.02);
    liveBot.history[inst.sym] = liveBot.history[inst.sym] || [];
    liveBot.history[inst.sym].push(noisy);
  }
});

setInterval(() => {
  universe.forEach(inst => tickPrice(inst));
  const events = liveBot.step(universe);
  events.forEach(ev => {
    // Inject as new "live" trade row when bot opens or closes a position
    if (ev.action === 'OPEN_LONG' || ev.action === 'OPEN_SHORT') {
      account.trades.unshift({
        id: 'T' + Date.now(),
        sym: ev.sym, asset: ev.asset,
        side: ev.action === 'OPEN_LONG' ? 'BUY' : 'SELL',
        qty: ev.qty, entry: ev.price, exit: ev.price,
        pl: 0, time: ev.time, bot: 'Vault Alpha · LIVE',
        status: 'OPEN',
      });
      toast(`Bot ${ev.action === 'OPEN_LONG' ? 'BOUGHT' : 'SOLD'} ${ev.sym} @ ${fmtPrice(ev.asset, ev.price)}`);
    } else if (ev.action.startsWith('CLOSE_')) {
      // mark matching open as closed
      const open = account.trades.find(t => t.sym === ev.sym && t.status === 'OPEN' && t.bot.includes('Vault Alpha'));
      if (open) {
        open.exit = ev.price; open.pl = +ev.pl.toFixed(2); open.status = 'CLOSED';
      }
      const kindLabel = ev.action.replace('CLOSE_', '').replaceAll('_', ' ');
      toast(`${ev.sym} closed (${kindLabel}) — ${ev.pl >= 0 ? '+' : ''}${fmtMoney(ev.pl)}`, ev.pl >= 0 ? 'success' : 'error');
    }
    setAccount(account);
    renderTrades(document.querySelector('#tradeFilters .active').dataset.cls);
  });
}, 6000);
