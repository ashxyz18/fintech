import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useToast } from '../components/Toast';
import { ALL_INSTRUMENTS, ALLOC_COLORS, MARKETS } from '../data/markets';
import type { BotEvent, BotEventClose, BotEventOpen, BotMetrics, Instrument, Regime } from '../types';
import { backtest, createBot, simulateFlow, tuneBot, type MasterAI } from '../lib/algo';
import { fmtMoney, fmtPrice, tickPrice } from '../lib/format';

interface BacktestResult extends BotMetrics { name: string }
interface TuneResult { config: Record<string, unknown>; metrics: BotMetrics }

export function Trading() {
  const { toast } = useToast();
  const botRef = useRef<MasterAI | null>(null);
  const universeRef = useRef<Instrument[]>([]);
  const [running, setRunning] = useState(true);
  const [feed, setFeed] = useState<BotEvent[]>([]);
  const [equityHistory, setEquityHistory] = useState<{ t: number; v: number }[]>([
    { t: Date.now(), v: 10000 },
  ]);
  const [metrics, setMetrics] = useState<BotMetrics>({
    total: 0, winRate: 0, avgWin: 0, avgLoss: 0, rr: 0, profitFactor: 0, expectancy: 0, netPnl: 0,
  });
  const [openPositions, setOpenPositions] = useState<{ sym: string; side: string; entry: number; cur: number; sl: number; tp: number; qty: number; asset: string; strategy: string }[]>([]);
  const [currentMode, setCurrentMode] = useState<Regime>('UNKNOWN');
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [tuneResult, setTuneResult]         = useState<TuneResult | null>(null);

  /* Build the universe + warm the bot once on mount */
  useEffect(() => {
    const universe: Instrument[] = [
      ...MARKETS.crypto.slice(0, 6),
      ...MARKETS.forex.slice(0, 4),
      ...MARKETS.stocks.slice(0, 5),
      ...MARKETS.indices.slice(0, 3),
      ...MARKETS.bonds.slice(0, 2),
    ].map(i => ({ ...i }));
    universeRef.current = universe;

    const bot = createBot('Vault Alpha');
    bot.equity = 10000;
    bot.startEquity = 10000;
    botRef.current = bot;

    // Warm history so signals can fire quickly
    universe.forEach(inst => {
      let p = inst.price * 0.97;
      for (let i = 0; i < 80; i++) {
        p *= 1 + (Math.random() - 0.49) * 0.012;
        const v = Math.random() * 800 + 200;
        const flow = simulateFlow(inst);
        bot.ingest({ ...inst, price: p }, v, flow);
      }
    });
  }, []);

  /* Live tick loop */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const bot = botRef.current;
      const universe = universeRef.current;
      if (!bot || !universe.length) return;

      universe.forEach(tickPrice);
      const ctx = {
        volumes: Object.fromEntries(universe.map(i => [i.sym, Math.random() * 800 + 200])),
        flow:    Object.fromEntries(universe.map(i => [i.sym, simulateFlow(i)])),
      };
      const events = bot.step(universe, ctx);
      if (events.length) {
        setFeed(prev => [...events.reverse(), ...prev].slice(0, 30));
      }

      let unrealized = 0;
      for (const p of Object.values(bot.positions)) {
        const cur = (universe.find(i => i.sym === p.sym) || { price: p.entry }).price;
        const dir = p.side === 'BUY' ? 1 : -1;
        unrealized += (cur - p.entry) * p.qty * dir;
      }
      const eq = bot.equity + unrealized;
      setEquityHistory(prev => {
        const next = [...prev, { t: Date.now(), v: +eq.toFixed(2) }];
        return next.length > 200 ? next.slice(-200) : next;
      });
      setMetrics(bot.metrics());
      setCurrentMode(bot.currentMode);
      setOpenPositions(Object.values(bot.positions).map(p => {
        const cur = (universe.find(i => i.sym === p.sym) || { price: p.entry }).price;
        return { sym: p.sym, side: p.side, entry: p.entry, cur, sl: p.stopLoss, tp: p.takeProfit, qty: p.qty, asset: p.asset, strategy: p.strategy };
      }));
    }, 2000);
    return () => clearInterval(id);
  }, [running]);

  /* ---------- backtest ---------- */
  function runBacktest() {
    setBacktestResult(null);
    setTuneResult(null);
    setTimeout(() => {
      const r = backtest('Vault Alpha', ['BTC', 'ETH', 'SOL', 'EURUSD', 'AAPL', 'NVDA', 'SPX'], 800);
      setBacktestResult(r);
      toast(`Backtest complete · ${r.winRate}% win rate, ${r.rr}:1 R:R`);
    }, 600);
  }
  function autoTune() {
    setBacktestResult(null);
    setTuneResult(null);
    setTimeout(() => {
      const r = tuneBot('Vault Alpha');
      if (r && botRef.current) {
        setTuneResult(r as TuneResult);
        Object.assign(botRef.current.cfg, r.config);
        toast(`Auto-tune complete · win rate ${r.metrics.winRate}%, exp ${fmtMoney(r.metrics.expectancy)}`);
      }
    }, 800);
  }

  const equityChartData = useMemo(() => {
    const series = equityHistory.slice(-120);
    const last = series[series.length - 1]?.v ?? 10000;
    const start = series[0]?.v ?? 10000;
    const up = last >= start;
    return {
      labels: series.map(p => new Date(p.t).toLocaleTimeString()),
      datasets: [{
        data: series.map(p => p.v),
        borderColor: up ? '#00ffa3' : '#ff2a4d',
        backgroundColor: 'rgba(0,255,163,0.1)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2.5,
      }],
    };
  }, [equityHistory]);

  const modeLabel = useMemo(() => {
    const map: Record<Regime, { label: string; color: string }> = {
      'TRENDING_UP':   { label: '⬆ TREND-FOLLOWING', color: 'var(--green)' },
      'TRENDING_DOWN': { label: '⬇ TREND-FOLLOWING', color: 'var(--red)' },
      'RANGING':       { label: '↔ MEAN-REVERSION',  color: 'var(--gold)' },
      'VOLATILE':      { label: '⚠ STANDING DOWN',   color: 'var(--red)' },
      'UNKNOWN':       { label: 'SCANNING',          color: 'var(--text-dim)' },
    };
    return map[currentMode] ?? map.UNKNOWN;
  }, [currentMode]);

  return (
    <>
      {/* HERO */}
      <div className="bot-hero">
        <div>
          <div className="bot-status" style={{
            background: running ? 'rgba(0,255,163,0.1)' : 'rgba(255,184,0,0.1)',
            color:      running ? 'var(--green)'        : 'var(--gold)',
            borderColor: running ? 'rgba(0,255,163,0.3)' : 'rgba(255,184,0,0.3)',
          }}>
            <span className="dot" />
            {running ? 'Active · scanning markets' : 'Paused'}
          </div>
          <h2>Vault AI</h2>
          <p>One unified AI manager. Adapts strategy mix to current market regime — automatically. 10 strategies, 6 asset classes, 24/7.</p>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setRunning(r => !r)}>
              <i className={`fa-solid ${running ? 'fa-pause' : 'fa-play'}`} /> {running ? 'Pause bot' : 'Resume bot'}
            </button>
            <button className="btn btn-ghost" onClick={runBacktest}><i className="fa-solid fa-flask" /> Run backtest</button>
            <button className="btn btn-ghost" onClick={autoTune}><i className="fa-solid fa-wand-magic-sparkles" /> Auto-tune</button>
          </div>
        </div>
        <div className="bot-img">
          <img src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=900&q=80" alt="AI Trading" />
        </div>
      </div>

      {/* UNIFIED BOT CARD */}
      <div className="strategy-grid mb-lg" style={{ gridTemplateColumns: '1fr' }}>
        <div className="strategy ring-card" style={{ cursor: 'default', padding: 30 }}>
          <div className="flex flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div className="flex gap-md" style={{ alignItems: 'center' }}>
              <div className="logo-mark" style={{ width: 54, height: 54, fontSize: '1.2rem' }}>AI</div>
              <div>
                <h3 style={{ margin: 0 }}>
                  Vault AI <span className="tag tag-buy" style={{ marginLeft: 8 }}>UNIFIED MANAGER</span>
                </h3>
                <div className="text-dim" style={{ fontSize: '0.9rem' }}>10 strategies · 6 asset classes · regime-adaptive</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-mute" style={{ fontSize: '0.78rem' }}>CURRENT MODE</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: modeLabel.color }}>{modeLabel.label}</div>
            </div>
          </div>
        </div>
      </div>

      {/* METRICS */}
      <div className="kpi-grid">
        <div className="kpi"><div className="label">Total trades</div><div className="value">{metrics.total}</div><div className="trend text-dim">Live session</div></div>
        <div className="kpi"><div className="label">Win rate</div><div className="value text-green">{metrics.winRate}%</div><div className="trend text-dim">All asset classes</div></div>
        <div className="kpi"><div className="label">Avg R:R achieved</div><div className="value">{metrics.rr.toFixed(2)}:1</div><div className="trend text-dim">avg win / avg loss</div></div>
        <div className="kpi"><div className="label">Profit factor</div><div className="value">{metrics.profitFactor.toFixed(2)}</div><div className="trend text-dim">gross profit / gross loss</div></div>
        <div className="kpi"><div className="label">Expectancy</div><div className={`value ${metrics.expectancy >= 0 ? 'text-green' : 'text-red'}`}>{metrics.expectancy >= 0 ? '+' : ''}{fmtMoney(metrics.expectancy)}</div><div className="trend text-dim">$ per trade</div></div>
        <div className="kpi"><div className="label">Net PnL (live)</div><div className={`value ${metrics.netPnl >= 0 ? 'text-green' : 'text-red'}`}>{metrics.netPnl >= 0 ? '+' : ''}{fmtMoney(metrics.netPnl)}</div><div className="trend text-dim">Since session start</div></div>
      </div>

      {/* LIVE FEED + EQUITY */}
      <div className="dash-grid">
        <div className="card glow chart-card">
          <div className="chart-head">
            <div>
              <h3>Bot equity curve <span className="text-dim" style={{ fontSize: '0.85rem', fontWeight: 400 }}>(live)</span></h3>
              <div className="text-dim" style={{ fontSize: '0.85rem' }}>PnL vs. session start. Updates every tick.</div>
            </div>
          </div>
          <div style={{ position: 'relative', height: 280 }}>
            <Line
              data={equityChartData}
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
            <div>
              <h3><i className="fa-solid fa-brain text-blue" /> Bot's reasoning</h3>
              <div className="text-dim" style={{ fontSize: '0.85rem' }}>Why we traded · live decisions</div>
            </div>
          </div>
          <div className="live-feed">
            {feed.length ? feed.map((ev, i) => <FeedItem key={i} ev={ev} />) : (
              <div className="text-dim" style={{ padding: 20, textAlign: 'center' }}>
                Warming up… signals will appear shortly.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OPEN POSITIONS */}
      <div className="card mb-lg">
        <div className="flex flex-between mb-md">
          <div>
            <h3>Bot's open positions</h3>
            <div className="text-dim" style={{ fontSize: '0.85rem' }}>SL = stop-loss, TP = take-profit. Trailing activates after +1R profit.</div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="trades-table">
            <thead><tr>
              <th>Asset</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Current</th>
              <th>Stop-loss</th><th>Take-profit</th><th>P/L</th><th>Strategy</th>
            </tr></thead>
            <tbody>
              {openPositions.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20 }} className="text-dim">No open positions. Bot is scanning…</td></tr>
              ) : openPositions.map(p => {
                const dir = p.side === 'BUY' ? 1 : -1;
                const pl = (p.cur - p.entry) * p.qty * dir;
                const plPct = ((p.cur - p.entry) / p.entry) * dir * 100;
                const up = pl >= 0;
                const asset = p.asset as keyof typeof ALLOC_COLORS;
                return (
                  <tr key={p.sym}>
                    <td>
                      <span className="tag" style={{ background: ALLOC_COLORS[asset] + '22', color: ALLOC_COLORS[asset] }}>
                        {p.asset.toUpperCase()}
                      </span>
                    </td>
                    <td><strong>{p.sym}</strong></td>
                    <td><span className={`tag ${p.side === 'BUY' ? 'tag-buy' : 'tag-sell'}`}>{p.side}</span></td>
                    <td>{fmtPrice(asset, p.entry)}</td>
                    <td>{fmtPrice(asset, p.cur)}</td>
                    <td className="text-red">{fmtPrice(asset, p.sl)}</td>
                    <td className="text-green">{fmtPrice(asset, p.tp)}</td>
                    <td className={up ? 'text-green' : 'text-red'}>
                      <strong>{up ? '+' : ''}{fmtMoney(pl)}</strong>{' '}
                      <span style={{ fontSize: '0.78rem' }}>({up ? '+' : ''}{plPct.toFixed(2)}%)</span>
                    </td>
                    <td className="text-dim" style={{ fontSize: '0.82rem' }}>{p.strategy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* HOW IT DECIDES */}
      <h2 style={{ marginBottom: 18 }}>How the AI decides</h2>
      <div className="features-grid mb-lg">
        {[
          { icon: 'fa-arrows-up-down-left-right', t: 'Multi-timeframe',     b: 'Signals must agree across short and medium timeframes before any capital is risked.' },
          { icon: 'fa-vials',                     t: 'Confluence engine',    b: '2+ independent strategies (Trend-ADX, MACD-Volume, VWAP, Order-Flow) must align in direction.' },
          { icon: 'fa-water',                     t: 'Order-flow aware',     b: 'Detects bid/ask imbalance to enter only when buyers (or sellers) are clearly aggressive.' },
          { icon: 'fa-chart-column',              t: 'Volume confirmation',  b: 'OBV must rise on bullish breaks (and fall on bearish) — no chasing thin moves.' },
          { icon: 'fa-globe',                     t: 'Regime detection',     b: 'Classifies the market as TRENDING / RANGING / VOLATILE. Skips all trades when it\'s volatile.' },
          { icon: 'fa-shield-halved',             t: 'Tight risk control',   b: '1.2% stop-loss · 3:1 reward target · Trailing stop · 5% daily-loss circuit breaker.' },
        ].map(f => (
          <div key={f.t} className="feature">
            <div className="feature-icon"><i className={`fa-solid ${f.icon}`} /></div>
            <h3>{f.t}</h3>
            <p>{f.b}</p>
          </div>
        ))}
      </div>

      {/* BACKTEST RESULT */}
      {backtestResult && (
        <div className="card glow mb-lg">
          <h3 className="mb-md"><i className="fa-solid fa-flask" /> Backtest results</h3>
          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            <div className="kpi"><div className="label">Bot</div><div className="value" style={{ fontSize: '1.1rem' }}>{backtestResult.name}</div></div>
            <div className="kpi"><div className="label">Total trades</div><div className="value">{backtestResult.total}</div></div>
            <div className="kpi"><div className="label">Win rate</div><div className="value text-green">{backtestResult.winRate}%</div></div>
            <div className="kpi"><div className="label">Avg R:R</div><div className="value">{backtestResult.rr}:1</div></div>
            <div className="kpi"><div className="label">Profit factor</div><div className="value">{backtestResult.profitFactor}</div></div>
            <div className="kpi"><div className="label">Expectancy</div><div className={`value ${backtestResult.expectancy >= 0 ? 'text-green' : 'text-red'}`}>{backtestResult.expectancy >= 0 ? '+' : ''}{fmtMoney(backtestResult.expectancy)}</div></div>
            <div className="kpi"><div className="label">Net PnL</div><div className={`value ${backtestResult.netPnl >= 0 ? 'text-green' : 'text-red'}`}>{backtestResult.netPnl >= 0 ? '+' : ''}{fmtMoney(backtestResult.netPnl)}</div></div>
          </div>
          <div className="text-dim" style={{ fontSize: '0.88rem' }}>
            Tested on synthetic OHLC across crypto, forex, stocks and indices with realistic regime shifts.
          </div>
        </div>
      )}

      {/* TUNE RESULT */}
      {tuneResult && (
        <div className="card glow mb-lg">
          <h4 className="mb-md text-green"><i className="fa-solid fa-wand-magic-sparkles" /> Best variant found</h4>
          <div className="kpi-grid">
            <div className="kpi"><div className="label">Stop-loss</div><div className="value">{((tuneResult.config.stopLossPct as number) * 100).toFixed(2)}%</div></div>
            <div className="kpi"><div className="label">Take-profit</div><div className="value">{((tuneResult.config.takeProfitPct as number) * 100).toFixed(2)}%</div></div>
            <div className="kpi"><div className="label">Confluence</div><div className="value">{tuneResult.config.requireConfluence as number}+</div></div>
            <div className="kpi"><div className="label">Min strength</div><div className="value">{((tuneResult.config.minSignalStrength as number) * 100).toFixed(0)}%</div></div>
            <div className="kpi"><div className="label">Win rate</div><div className="value text-green">{tuneResult.metrics.winRate}%</div></div>
            <div className="kpi"><div className="label">Expectancy</div><div className="value text-green">+{fmtMoney(tuneResult.metrics.expectancy)}</div></div>
          </div>
          <div className="text-dim mt-md" style={{ fontSize: '0.88rem' }}>
            Tuner picked the variant that maximized expectancy. Live bot is now running with these parameters.
          </div>
        </div>
      )}
    </>
  );
}

/* --------- LIVE FEED ITEM --------- */
function FeedItem({ ev }: { ev: BotEvent }) {
  const isOpen = ev.action.startsWith('OPEN_');
  const isClose = ev.action.startsWith('CLOSE_');
  const closeEv = isClose ? (ev as BotEventClose) : null;
  const openEv  = isOpen  ? (ev as BotEventOpen)  : null;
  const positivePl = closeEv ? closeEv.pl >= 0 : true;

  let icon: string, color: string;
  if (isOpen) {
    icon = ev.action === 'OPEN_LONG' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    color = ev.action === 'OPEN_LONG' ? 'var(--green)' : 'var(--red)';
  } else if (isClose) {
    icon = positivePl ? 'fa-circle-check' : 'fa-circle-xmark';
    color = positivePl ? 'var(--green)' : 'var(--red)';
  } else {
    icon = 'fa-bolt'; color = 'var(--blue-glow)';
  }

  function pretty() {
    if (ev.action === 'OPEN_LONG')  return `Opened LONG ${ev.sym}`;
    if (ev.action === 'OPEN_SHORT') return `Opened SHORT ${ev.sym}`;
    if (ev.action === 'CLOSE_TAKE_PROFIT') return `Closed ${ev.sym} · Take-profit`;
    if (ev.action === 'CLOSE_STOP_LOSS')   return `Closed ${ev.sym} · Stop-loss`;
    if (ev.action === 'CLOSE_TRAILING_STOP') return `Closed ${ev.sym} · Trailing stop`;
    return ev.action;
  }

  return (
    <div className="feed-item">
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '22', color, display: 'grid', placeItems: 'center' }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div className="what">
        <div style={{ fontWeight: 600 }}>
          {pretty()} <span className="text-dim" style={{ fontWeight: 400 }}>at {fmtPrice(ev.asset, ev.price)}</span>
        </div>
        {(openEv?.reason || closeEv?.reason) && (
          <div className="text-dim" style={{ fontSize: '0.85rem', marginTop: 2 }}>
            {openEv?.reason ?? closeEv?.reason}
          </div>
        )}
        {openEv?.thinking && (
          <details style={{ marginTop: 6 }}>
            <summary className="text-blue" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
              <i className="fa-solid fa-brain" /> Show AI reasoning chain
            </summary>
            <div style={{ marginTop: 6, padding: 10, background: 'rgba(31,109,255,0.06)', borderRadius: 8, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>
              {openEv.thinking.map((s, i) => <div key={i}>{s}</div>)}
            </div>
          </details>
        )}
        {openEv && (
          <div className="text-mute" style={{ fontSize: '0.75rem', marginTop: 2 }}>
            Regime: {openEv.regime} · Strategy: {openEv.strategy} · Conf: {(openEv.strength * 100).toFixed(0)}%
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {closeEv && (
          <div className={`pl ${closeEv.pl >= 0 ? 'up' : 'down'}`}>
            {closeEv.pl >= 0 ? '+' : ''}{fmtMoney(closeEv.pl)}
          </div>
        )}
        <div className="when">{new Date(ev.time).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

/* Re-export to silence unused-import warnings (ALL_INSTRUMENTS is reused elsewhere) */
export const _internal = ALL_INSTRUMENTS;
