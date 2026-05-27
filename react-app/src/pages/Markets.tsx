import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useToast } from '../components/Toast';
import { useAccount } from '../lib/useAccount';
import { ALLOC_COLORS, ALL_INSTRUMENTS, FUNDAMENTALS, MARKETS } from '../data/markets';
import type { AssetClass, Instrument, Trade } from '../types';
import { fmtPrice, tickPrice } from '../lib/format';

type ClassFilter = AssetClass | 'all';

export function Markets() {
  const [instruments, setInstruments] = useState<Instrument[]>(() =>
    ALL_INSTRUMENTS.map(i => ({ ...i })),
  );
  const [filter, setFilter] = useState<ClassFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedSym, setSelectedSym] = useState('BTC');
  const { toast } = useToast();
  const [account, update] = useAccount();

  /* live tick — refresh every 2.5s */
  useEffect(() => {
    const id = setInterval(() => {
      setInstruments(prev => prev.map(i => ({ ...tickPrice({ ...i }) })));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const list = useMemo(() => {
    let xs = filter === 'all'
      ? instruments
      : instruments.filter(i => i.asset === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      xs = xs.filter(i =>
        i.sym.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.pair.toLowerCase().includes(q)
      );
    }
    return xs;
  }, [instruments, filter, search]);

  const selected = useMemo(() =>
    instruments.find(i => i.sym === selectedSym) ?? instruments[0],
  [instruments, selectedSym]);

  function quickTrade(side: 'BUY' | 'SELL') {
    if (!selected) return;
    const inst = selected;
    const amt = 250;
    if (side === 'BUY' && account.wallets.trading.balance < amt) {
      toast('Trading wallet too low. Transfer from main first.', 'error');
      return;
    }
    const trade: Trade = {
      id: 'T' + Date.now(),
      sym: inst.sym,
      asset: inst.asset ?? 'crypto',
      side,
      qty: amt / inst.price,
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
          balance: +(prev.wallets.trading.balance + (side === 'BUY' ? -amt : amt)).toFixed(2),
        },
      },
    }));
    toast(`${side} order placed for ${inst.sym} at ${fmtPrice(inst.asset, inst.price)}`);
  }

  /* class overview */
  const overview = useMemo(() => {
    const out: Record<AssetClass, { count: number; chg: number }> = {} as never;
    for (const cls of Object.keys(MARKETS) as AssetClass[]) {
      const arr = instruments.filter(i => i.asset === cls);
      if (!arr.length) continue;
      out[cls] = {
        count: arr.length,
        chg: arr.reduce((a, b) => a + b.chg, 0) / arr.length,
      };
    }
    return out;
  }, [instruments]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Markets</h1>
          <div className="sub">
            Live prices across <strong>Crypto</strong>, <strong>Forex</strong>, <strong>Stocks</strong>, <strong>Indices</strong> and <strong>Bonds</strong>.
          </div>
        </div>
        <div className="flex gap-sm">
          <span className="hero-badge" style={{ margin: 0 }}>
            <span className="pulse" /> <span style={{ fontSize: '0.82rem' }}>Live · auto-refreshing</span>
          </span>
        </div>
      </div>

      {/* OVERVIEW */}
      <div className="kpi-grid mb-lg">
        {(['crypto', 'forex', 'stocks', 'indices', 'bonds'] as const).map(cls => {
          const o = overview[cls];
          if (!o) return null;
          const up = o.chg >= 0;
          return (
            <div className="kpi" key={cls} style={{ cursor: 'pointer' }} onClick={() => setFilter(cls)}>
              <div className="label" style={{ color: ALLOC_COLORS[cls] }}>
                <i className={cls === 'crypto' ? 'fa-brands fa-bitcoin' : `fa-solid fa-${
                  cls === 'forex' ? 'money-bill-trend-up' : cls === 'stocks' ? 'chart-line' : cls === 'indices' ? 'chart-pie' : 'landmark'
                }`} /> {cls[0].toUpperCase() + cls.slice(1)}
              </div>
              <div className="value">{o.count} assets</div>
              <div className="trend" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
                {up ? '▲' : '▼'} {o.chg.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* TABLE */}
        <div className="card glow">
          <div className="flex flex-between mb-md" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3>Instruments</h3>
              <div className="text-dim" style={{ fontSize: '0.85rem' }}>
                {filter === 'all' ? 'All assets' : filter[0].toUpperCase() + filter.slice(1)}
              </div>
            </div>
            <div className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '8px 14px', background: 'var(--bg-elev)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', width: 180, fontSize: '0.9rem',
                }}
              />
              <div className="chart-tabs">
                {(['all', 'crypto', 'forex', 'stocks', 'indices', 'bonds'] as ClassFilter[]).map(c => (
                  <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="markets-table">
              <thead>
                <tr><th>Asset</th><th>Price</th><th>24h %</th><th>7d trend</th><th>Fundamental</th><th>Action</th></tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }} className="text-dim">No matches.</td></tr>
                ) : list.map(i => {
                  const cls = i.asset ?? 'crypto';
                  const up = i.chg >= 0;
                  return (
                    <tr key={i.sym} style={{ cursor: 'pointer' }} onClick={() => setSelectedSym(i.sym)}>
                      <td>
                        <div className="coin-cell">
                          <div className="coin-icon" style={{ background: ALLOC_COLORS[cls], width: 36, height: 36, fontSize: '0.85rem' }}>
                            {i.icon || i.sym[0]}
                          </div>
                          <div>
                            <strong>{i.sym}</strong>
                            <div className="text-mute" style={{ fontSize: '0.78rem' }}>{i.name}</div>
                          </div>
                        </div>
                      </td>
                      <td><strong>{fmtPrice(cls, i.price)}</strong></td>
                      <td className={up ? 'text-green' : 'text-red'}><strong>{up ? '+' : ''}{i.chg.toFixed(2)}%</strong></td>
                      <td><Sparkline seed={i.sym.charCodeAt(0)} up={up} /></td>
                      <td><FundamentalBadge sym={i.sym} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={e => { e.stopPropagation(); setSelectedSym(i.sym); quickTrade('BUY'); }}
                        >
                          <i className="fa-solid fa-bolt" /> Trade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETAIL */}
        <div>
          {selected && <DetailPanel inst={selected} onBuy={() => quickTrade('BUY')} onSell={() => quickTrade('SELL')} />}
          <div className="card">
            <h3 className="mb-md"><i className="fa-solid fa-newspaper text-blue" /> Market news</h3>
            {NEWS.map(n => (
              <div key={n.title} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="flex flex-between" style={{ marginBottom: 4 }}>
                  <span className="tag tag-buy" style={{ background: 'rgba(0,162,255,0.1)', color: 'var(--blue-glow)' }}>{n.sym}</span>
                  <span className="text-mute" style={{ fontSize: '0.75rem' }}>{n.time} ago · {n.src}</span>
                </div>
                <div style={{ fontSize: '0.9rem' }}>{n.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* --------- DETAIL PANEL --------- */
function DetailPanel({ inst, onBuy, onSell }: { inst: Instrument; onBuy: () => void; onSell: () => void }) {
  const cls = inst.asset ?? 'crypto';
  const up = inst.chg >= 0;
  const series = useMemo(() => {
    const out: number[] = [];
    let v = inst.price * 0.97;
    for (let i = 0; i < 60; i++) {
      v *= 1 + (Math.random() - 0.48) * 0.01;
      out.push(v);
    }
    out[out.length - 1] = inst.price;
    return out;
  }, [inst.sym]); // recompute when symbol changes

  return (
    <div className="card glow mb-lg">
      <div className="flex gap-md mb-md" style={{ alignItems: 'center' }}>
        <div className="coin-icon" style={{ width: 48, height: 48, fontSize: '1.1rem', background: ALLOC_COLORS[cls] }}>
          {inst.icon || inst.sym[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div className="flex flex-between">
            <strong style={{ fontSize: '1.2rem' }}>{inst.sym}</strong>
            <span className="tag" style={{ background: ALLOC_COLORS[cls] + '22', color: ALLOC_COLORS[cls] }}>
              {cls.toUpperCase()}
            </span>
          </div>
          <div className="text-dim" style={{ fontSize: '0.85rem' }}>{inst.name}</div>
        </div>
      </div>
      <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
        {fmtPrice(cls, inst.price)}
      </div>
      <div className={up ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
        {up ? '+' : ''}{inst.chg.toFixed(2)}%
      </div>

      <div style={{ position: 'relative', height: 160, marginTop: 14 }}>
        <Line
          data={{
            labels: series.map((_, i) => i),
            datasets: [{
              data: series,
              borderColor: up ? '#00ffa3' : '#ff2a4d',
              backgroundColor: up ? 'rgba(0,255,163,0.2)' : 'rgba(255,42,77,0.2)',
              fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
            }],
          }}
          options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
          }}
        />
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div className="kpi" style={{ padding: 12 }}><div className="label" style={{ fontSize: '0.78rem' }}>24h High</div><div className="value" style={{ fontSize: '1rem' }}>{fmtPrice(cls, inst.price * 1.024)}</div></div>
        <div className="kpi" style={{ padding: 12 }}><div className="label" style={{ fontSize: '0.78rem' }}>24h Low</div><div className="value" style={{ fontSize: '1rem' }}>{fmtPrice(cls, inst.price * 0.976)}</div></div>
        <div className="kpi" style={{ padding: 12 }}><div className="label" style={{ fontSize: '0.78rem' }}>Volume</div><div className="value" style={{ fontSize: '1rem' }}>${(Math.random() * 800 + 100).toFixed(0)}M</div></div>
        <div className="kpi" style={{ padding: 12 }}><div className="label" style={{ fontSize: '0.78rem' }}>RSI(14)</div><div className="value" style={{ fontSize: '1rem' }}>{(40 + Math.random() * 30).toFixed(0)}</div></div>
      </div>

      <div className="flex gap-sm mt-md">
        <button className="btn btn-primary btn-block" onClick={onBuy}><i className="fa-solid fa-arrow-trend-up" /> Buy</button>
        <button className="btn btn-danger btn-block"  onClick={onSell}><i className="fa-solid fa-arrow-trend-down" /> Sell</button>
      </div>
    </div>
  );
}

/* --------- SPARKLINE --------- */
function Sparkline({ seed, up }: { seed: number; up: boolean }) {
  const path = useMemo(() => {
    const points: number[] = [];
    let v = 50;
    for (let i = 0; i < 24; i++) {
      v += (Math.sin(seed + i * 0.5) + (Math.random() - 0.5)) * 2.5;
      v += (up ? 0.4 : -0.4) * i;
      points.push(v);
    }
    const min = Math.min(...points), max = Math.max(...points);
    return points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 30 - ((p - min) / ((max - min) || 1)) * 30;
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }, [seed, up]);
  const color = up ? '#00ffa3' : '#ff2a4d';
  return (
    <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

function FundamentalBadge({ sym }: { sym: string }) {
  const f = FUNDAMENTALS[sym] ?? 0;
  let label: string, color: string;
  if (f >= 1)        { label = 'Strong buy';  color = '#00ffa3'; }
  else if (f >= 0.3) { label = 'Buy';         color = '#00e5ff'; }
  else if (f >= -0.3){ label = 'Neutral';     color = '#9aa3b8'; }
  else if (f >= -1)  { label = 'Sell';        color = '#ffb800'; }
  else               { label = 'Strong sell'; color = '#ff2a4d'; }
  return <span className="tag" style={{ background: color + '22', color }}>{label}</span>;
}

const NEWS = [
  { time: '2h',  sym: 'BTC',    title: 'Bitcoin reclaims $67K as ETF inflows hit 30-day high.', src: 'Bloomberg' },
  { time: '3h',  sym: 'NVDA',   title: 'NVIDIA reports record Q3 earnings, AI chip demand surges.', src: 'Reuters' },
  { time: '5h',  sym: 'EURUSD', title: 'ECB hints at slower pace of rate cuts in 2026.', src: 'FT' },
  { time: '6h',  sym: 'SPX',    title: 'S&P 500 closes at all-time high on tech rally.', src: 'CNBC' },
  { time: '8h',  sym: 'ETH',    title: 'Ethereum dev team confirms next upgrade for Q3.', src: 'CoinDesk' },
  { time: '11h', sym: 'US10Y',  title: 'US 10-year yields edge higher ahead of CPI print.', src: 'WSJ' },
];
