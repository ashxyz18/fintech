import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut, Line } from 'react-chartjs-2';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/useAccount';
import { useToast } from '../components/Toast';
import { fmtMoney, fmtPrice } from '../lib/format';
import { ALL_INSTRUMENTS, ALLOC_COLORS } from '../data/markets';
import type { AssetClass, Trade } from '../types';

type Range = '1D' | '1W' | '1M' | '3M' | 'ALL';

export function Dashboard() {
  const { user } = useAuth();
  const [account, update] = useAccount();
  const { toast } = useToast();
  const [range, setRange] = useState<Range>('1M');
  const [tradeFilter, setTradeFilter] = useState<AssetClass | 'all'>('all');
  const [holdFilter, setHoldFilter]   = useState<AssetClass | 'all'>('all');
  const [transferOpen, setTransferOpen] = useState(false);

  const equityData = useMemo(() => {
    const e = account.equity;
    const slice =
      range === '1D'  ? e.slice(-2)  :
      range === '1W'  ? e.slice(-7)  :
      range === '1M'  ? e.slice(-30) :
      range === '3M'  ? e.slice(-60) :
                        e;
    return slice;
  }, [account.equity, range]);

  const allocByClass = useMemo(() => {
    const byClass: Record<string, number> = {};
    for (const h of account.holdings) byClass[h.asset] = (byClass[h.asset] ?? 0) + h.value;
    return byClass;
  }, [account.holdings]);

  const filteredTrades = useMemo(() => {
    return tradeFilter === 'all' ? account.trades : account.trades.filter(t => t.asset === tradeFilter);
  }, [account.trades, tradeFilter]);

  const filteredHoldings = useMemo(() => {
    return holdFilter === 'all' ? account.holdings : account.holdings.filter(h => h.asset === holdFilter);
  }, [account.holdings, holdFilter]);

  /* ---- Quick trade form state ---- */
  const [qtSym, setQtSym] = useState('BTC');
  const [qtAmt, setQtAmt] = useState(250);
  const [qtType, setQtType] = useState('Market');

  function placeOrder(side: 'BUY' | 'SELL') {
    const inst = ALL_INSTRUMENTS.find(i => i.sym === qtSym);
    if (!inst) return;
    if (side === 'BUY' && account.wallets.trading.balance < qtAmt) {
      toast('Trading wallet too low. Transfer from main first.', 'error');
      return;
    }
    const trade: Trade = {
      id: 'T' + Date.now(),
      sym: inst.sym,
      asset: inst.asset ?? 'crypto',
      side,
      qty: qtAmt / inst.price,
      entry: inst.price,
      exit: inst.price,
      pl: 0,
      time: Date.now(),
      bot: 'Manual',
      status: 'OPEN',
    };
    update(prev => ({
      ...prev,
      trades: [trade, ...prev.trades],
      wallets: {
        ...prev.wallets,
        trading: {
          balance: +(prev.wallets.trading.balance + (side === 'BUY' ? -qtAmt : qtAmt)).toFixed(2),
        },
      },
    }));
    toast(`${side} order placed for ${inst.sym} at ${fmtPrice(inst.asset, inst.price)}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, <span>{user?.name || user?.email?.split('@')[0]}</span> <span style={{ fontWeight: 400 }}>👋</span></h1>
          <div className="sub">Your AI bots executed <strong>{account.trades.length}</strong> trades across crypto, forex, stocks, indices and bonds.</div>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-ghost" onClick={() => setTransferOpen(true)}>
            <i className="fa-solid fa-right-left" /> Transfer
          </button>
          <Link to="/deposit" className="btn btn-primary">
            <i className="fa-solid fa-plus" /> Deposit
          </Link>
        </div>
      </div>

      {/* BALANCE CARD */}
      <div className="balance-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="label">Total portfolio value</div>
            <div className="amount">{fmtMoney(account.balance)}</div>
            <div className="delta"><i className="fa-solid fa-arrow-trend-up" /> +18.4% (30 days)</div>
          </div>
          <div>
            <div className="label"><i className="fa-solid fa-wallet" style={{ color: 'var(--blue-glow)' }} /> Main wallet</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmtMoney(account.wallets.main.balance)}</div>
            <div className="text-mute" style={{ fontSize: '0.82rem', marginTop: 4 }}>Cash · Withdrawable</div>
          </div>
          <div>
            <div className="label"><i className="fa-solid fa-robot" style={{ color: 'var(--red)' }} /> Trading wallet</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{fmtMoney(account.wallets.trading.balance)}</div>
            <div className="text-mute" style={{ fontSize: '0.82rem', marginTop: 4 }}>Allocated to bots</div>
          </div>
          <div>
            <div className="label">All-time PnL</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }} className="text-green">+{fmtMoney(account.pnlAllTime)}</div>
            <div className="text-mute" style={{ fontSize: '0.82rem', marginTop: 4 }}>Since first deposit</div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 24 }}>
          <Link to="/deposit" className="btn btn-primary"><i className="fa-solid fa-plus" /> Deposit to main</Link>
          <button className="btn btn-ghost" onClick={() => setTransferOpen(true)}>
            <i className="fa-solid fa-right-left" /> Transfer between wallets
          </button>
          <Link to="/withdraw" className="btn btn-ghost"><i className="fa-solid fa-arrow-up" /> Withdraw from main</Link>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Today's PnL</div><div className="value text-green">+{fmtMoney(account.pnl30d / 30)}</div><div className="trend text-green">+0.62%</div></div>
        <div className="kpi"><div className="label">30-day PnL</div><div className="value text-green">+{fmtMoney(account.pnl30d)}</div><div className="trend text-green">+18.40%</div></div>
        <div className="kpi"><div className="label">Win rate</div><div className="value">{account.winRate}%</div><div className="trend text-dim">Last 100 trades</div></div>
        <div className="kpi"><div className="label">Open positions</div><div className="value">{account.holdings.length}</div><div className="trend text-dim">Across {Object.keys(allocByClass).length} asset classes</div></div>
        <div className="kpi"><div className="label">Bot status</div><div className="value text-green"><i className="fa-solid fa-circle" style={{ fontSize: '0.7rem' }} /> Active</div><div className="trend text-dim">Vault AI · live</div></div>
      </div>

      {/* CHART + ALLOCATION */}
      <div className="dash-grid">
        <div className="card glow chart-card">
          <div className="chart-head">
            <div>
              <h3>Portfolio Performance</h3>
              <div className="text-dim" style={{ fontSize: '0.85rem' }}>Equity curve · Total return over time</div>
            </div>
            <div className="chart-tabs">
              {(['1D', '1W', '1M', '3M', 'ALL'] as Range[]).map(r => (
                <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', height: 300 }}>
            <Line
              data={{
                labels: equityData.map(p => new Date(p.t).toLocaleDateString()),
                datasets: [{
                  data: equityData.map(p => p.v),
                  borderColor: '#00ffa3',
                  backgroundColor: ctx => {
                    const c = ctx.chart.ctx; const g = c.createLinearGradient(0, 0, 0, 300);
                    g.addColorStop(0, 'rgba(0,255,163,0.4)');
                    g.addColorStop(1, 'rgba(0,255,163,0)');
                    return g;
                  },
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  borderWidth: 2.5,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                  y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => '$' + (Number(v) / 1000).toFixed(1) + 'k' } },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <div className="flex flex-between mb-md">
            <h3>Allocation</h3>
            <span className="text-mute" style={{ fontSize: '0.82rem' }}>By asset class</span>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <Doughnut
              data={{
                labels: Object.keys(allocByClass),
                datasets: [{
                  data: Object.values(allocByClass),
                  backgroundColor: Object.keys(allocByClass).map(k => ALLOC_COLORS[k as AssetClass] || '#888'),
                  borderColor: 'transparent',
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } },
              }}
            />
          </div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
            {Object.entries(allocByClass).map(([k, v]) => (
              <div key={k} className="flex flex-between">
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ALLOC_COLORS[k as AssetClass], marginRight: 8 }} />{k.toUpperCase()}</span>
                <strong>{fmtMoney(v)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OPEN POSITIONS + QUICK TRADE */}
      <div className="dash-grid">
        <div className="card">
          <div className="flex flex-between mb-md">
            <div>
              <h3>Open Positions</h3>
              <div className="text-dim" style={{ fontSize: '0.85rem' }}>Live market value</div>
            </div>
            <div className="chart-tabs">
              {(['all', 'crypto', 'forex', 'stocks', 'indices', 'bonds'] as const).map(c => (
                <button key={c} className={holdFilter === c ? 'active' : ''} onClick={() => setHoldFilter(c)}>
                  {c[0].toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="assets-list">
            {filteredHoldings.length ? filteredHoldings.map(h => (
              <div className="asset-item" key={h.sym + h.asset}>
                <div className="coin-cell">
                  <div className="coin-icon" style={{ background: ALLOC_COLORS[h.asset], width: 36, height: 36, fontSize: '0.85rem' }}>
                    {h.sym[0]}
                  </div>
                  <div>
                    <strong>{h.sym}</strong>
                    <div className="text-mute" style={{ fontSize: '0.78rem' }}>{h.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} units</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>{fmtMoney(h.value)}</strong>
                  <div className="text-mute" style={{ fontSize: '0.78rem' }}>avg {fmtPrice(h.asset, h.avg)}</div>
                </div>
              </div>
            )) : (
              <div className="text-dim" style={{ textAlign: 'center', padding: 20 }}>No positions in this asset class.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex flex-between mb-md">
            <h3>Quick Trade</h3>
            <span className="text-mute" style={{ fontSize: '0.82rem' }}>Manual order</span>
          </div>
          <div className="form-group">
            <label>Instrument</label>
            <select value={qtSym} onChange={e => setQtSym(e.target.value)}>
              {ALL_INSTRUMENTS.map(i => (
                <option key={i.sym} value={i.sym}>{i.sym} — {i.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Order type</label>
            <select value={qtType} onChange={e => setQtType(e.target.value)}>
              <option>Market</option>
              <option>Limit</option>
              <option>Stop</option>
            </select>
          </div>
          <div className="form-group">
            <label>Amount (USD)</label>
            <input type="number" min={10} placeholder="100" value={qtAmt} onChange={e => setQtAmt(parseFloat(e.target.value || '0'))} />
          </div>
          <div className="flex gap-sm">
            <button className="btn btn-primary btn-block" onClick={() => placeOrder('BUY')}>
              <i className="fa-solid fa-arrow-trend-up" /> Buy
            </button>
            <button className="btn btn-danger btn-block" onClick={() => placeOrder('SELL')}>
              <i className="fa-solid fa-arrow-trend-down" /> Sell
            </button>
          </div>
          <div className="text-mute mt-md" style={{ fontSize: '0.78rem', textAlign: 'center' }}>
            <i className="fa-solid fa-shield" /> Orders simulated for demo. Real funds never at risk.
          </div>
        </div>
      </div>

      {/* TRADE HISTORY */}
      <div className="card mb-lg">
        <div className="flex flex-between mb-md" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3>Trade History</h3>
            <div className="text-dim" style={{ fontSize: '0.85rem' }}>All trades executed by you and your bots</div>
          </div>
          <div className="chart-tabs">
            {(['all', 'crypto', 'forex', 'stocks', 'indices', 'bonds'] as const).map(c => (
              <button key={c} className={tradeFilter === c ? 'active' : ''} onClick={() => setTradeFilter(c)}>
                {c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="trades-table">
            <thead>
              <tr>
                <th>Time</th><th>Asset</th><th>Symbol</th><th>Side</th>
                <th>Qty</th><th>Entry</th><th>Exit</th><th>P/L</th>
                <th>Bot</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.slice(0, 25).map(t => (
                <tr key={t.id}>
                  <td className="text-dim" style={{ fontSize: '0.82rem' }}>{new Date(t.time).toLocaleString()}</td>
                  <td>
                    <span className="tag" style={{ background: ALLOC_COLORS[t.asset] + '22', color: ALLOC_COLORS[t.asset] }}>
                      {t.asset.toUpperCase()}
                    </span>
                  </td>
                  <td><strong>{t.sym}</strong></td>
                  <td>
                    <span className={`tag ${t.side === 'BUY' ? 'tag-buy' : 'tag-sell'}`}>{t.side}</span>
                  </td>
                  <td>{t.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td>{fmtPrice(t.asset, t.entry)}</td>
                  <td>{fmtPrice(t.asset, t.exit)}</td>
                  <td className={t.pl >= 0 ? 'text-green' : 'text-red'}>
                    <strong>{t.pl >= 0 ? '+' : ''}{fmtMoney(t.pl)}</strong>
                  </td>
                  <td className="text-dim" style={{ fontSize: '0.82rem' }}>{t.bot}</td>
                  <td><span className="tag">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEPOSITS / WITHDRAWALS */}
      <div className="dash-grid">
        <div className="card">
          <div className="flex flex-between mb-md">
            <h3>Recent Deposits</h3>
            <Link to="/deposit" className="text-blue" style={{ fontSize: '0.85rem' }}>New deposit →</Link>
          </div>
          {account.deposits.map(d => (
            <div className="flex flex-between" key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{fmtMoney(d.amount)}</strong>
                <div className="text-mute" style={{ fontSize: '0.78rem' }}>{d.method} · {new Date(d.time).toLocaleDateString()}</div>
              </div>
              <span className="tag tag-buy">{d.status}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="flex flex-between mb-md">
            <h3>Recent Withdrawals</h3>
            <Link to="/withdraw" className="text-blue" style={{ fontSize: '0.85rem' }}>New withdrawal →</Link>
          </div>
          {account.withdrawals.map(w => (
            <div className="flex flex-between" key={w.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{fmtMoney(w.amount)}</strong>
                <div className="text-mute" style={{ fontSize: '0.78rem' }}>{w.method} · {new Date(w.time).toLocaleDateString()}</div>
              </div>
              <span className="tag tag-buy">{w.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TRANSFER MODAL */}
      {transferOpen && (
        <TransferModal
          mainBal={account.wallets.main.balance}
          tradingBal={account.wallets.trading.balance}
          onClose={() => setTransferOpen(false)}
          onTransfer={(from, amount) => {
            if (amount <= 0) return;
            const to = from === 'main' ? 'trading' : 'main';
            const fromBal = account.wallets[from].balance;
            if (amount > fromBal) {
              toast('Insufficient balance', 'error');
              return;
            }
            update(prev => ({
              ...prev,
              wallets: {
                main: {
                  balance: +(prev.wallets.main.balance + (from === 'main' ? -amount : amount)).toFixed(2),
                },
                trading: {
                  balance: +(prev.wallets.trading.balance + (from === 'trading' ? -amount : amount)).toFixed(2),
                },
              },
              transfers: [
                { id: 'X' + Date.now(), from, to, amount, time: Date.now() },
                ...prev.transfers,
              ],
            }));
            toast(`Transferred ${fmtMoney(amount)} from ${from} to ${to}`);
            setTransferOpen(false);
          }}
        />
      )}
    </>
  );
}

/* --------- TRANSFER MODAL --------- */
function TransferModal({
  mainBal, tradingBal, onClose, onTransfer,
}: {
  mainBal: number;
  tradingBal: number;
  onClose: () => void;
  onTransfer: (from: 'main' | 'trading', amount: number) => void;
}) {
  const [from, setFrom] = useState<'main' | 'trading'>('main');
  const [amount, setAmount] = useState(0);
  const fromBal = from === 'main' ? mainBal : tradingBal;
  const toBal = from === 'main' ? tradingBal : mainBal;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card glow" style={{ maxWidth: 480, width: '100%' }}>
        <div className="flex flex-between mb-md">
          <h3>Transfer between wallets</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="text-dim mb-md" style={{ fontSize: '0.9rem' }}>Move funds between Main (cash) and Trading (bot capital). No fees.</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', marginBottom: 18 }}>
          <div className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div className="text-mute" style={{ fontSize: '0.75rem' }}>FROM</div>
            <div style={{ fontWeight: 700 }}>{from === 'main' ? 'Main wallet' : 'Trading wallet'}</div>
            <div className="text-dim" style={{ fontSize: '0.85rem' }}>{fmtMoney(fromBal)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setFrom(f => f === 'main' ? 'trading' : 'main')}>
            <i className="fa-solid fa-right-left" />
          </button>
          <div className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div className="text-mute" style={{ fontSize: '0.75rem' }}>TO</div>
            <div style={{ fontWeight: 700 }}>{from === 'main' ? 'Trading wallet' : 'Main wallet'}</div>
            <div className="text-dim" style={{ fontSize: '0.85rem' }}>{fmtMoney(toBal)}</div>
          </div>
        </div>

        <div className="amount-input-wrap">
          <input
            type="number"
            className="amount-input"
            placeholder="$0.00"
            min={10}
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value || '0'))}
          />
        </div>
        <div className="preset-amounts">
          {[0.25, 0.5, 0.75, 1].map(p => (
            <button key={p} onClick={() => setAmount(+(fromBal * p).toFixed(2))}>
              {p === 1 ? 'MAX' : `${p * 100}%`}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => onTransfer(from, amount)}>
          <i className="fa-solid fa-bolt" /> Transfer instantly
        </button>
        <div className="text-mute mt-md text-center" style={{ fontSize: '0.78rem' }}>
          <i className="fa-solid fa-shield" /> Internal transfer · 0 fees · Instant
        </div>
      </div>
    </div>
  );
}
