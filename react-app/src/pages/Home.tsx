import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_INSTRUMENTS, MARKETS } from '../data/markets';
import type { AssetClass, Instrument } from '../types';
import { fmtPrice, tickPrice } from '../lib/format';

/* ===========================================================
   HOME — landing page (hero + features + how-it-works +
   stats + risk profiles + heatmap + AI showcase + live
   payouts + ROI calculator + FAQ + CTA).
   =========================================================== */
export function Home() {
  return (
    <>
      <Hero />
      <Ticker />
      <Features />
      <HowItWorks />
      <StatsBand />
      <RiskProfiles />
      <Heatmap />
      <LivePayouts />
      <ROICalculator />
      <FAQ />
      <CTA />
    </>
  );
}

/* --------- HERO --------- */
function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-badge">
              <span className="pulse" />
              <span>The first AI-driven hedge fund open to everyone · $2.4B AUM</span>
            </div>
            <h1>
              The hedge fund<br />
              <span className="gradient-text">built for everyone.</span>
            </h1>
            <p className="lead">
              Subscribe to institutional-grade AI funds trading{' '}
              <strong>crypto, forex, stocks, indices and bonds</strong>. Start from $50.
              No accreditation. Withdraw anytime.
            </p>
            <div className="hero-cta">
              <Link to="/signup" className="btn btn-primary btn-lg">
                Start investing <i className="fa-solid fa-arrow-right" />
              </Link>
              <Link to="/trading" className="btn btn-ghost btn-lg">
                <i className="fa-solid fa-circle-play" /> See bots live
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat"><strong>$2.4B+</strong><span>Assets under management</span></div>
              <div className="stat"><strong>180k+</strong><span>Investors worldwide</span></div>
              <div className="stat"><strong>27.4%</strong><span>Avg. annual return</span></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="float-card fc-1 glow">
              <div className="coin-row">
                <div className="coin-icon coin-btc">₿</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>Bitcoin</div>
                  <div style={{ color: 'var(--text-mute)', fontSize: '0.8rem' }}>BTC / USD · Crypto</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>$67,420</div>
                  <div className="text-green" style={{ fontSize: '0.85rem' }}>+4.21%</div>
                </div>
              </div>
            </div>
            <div className="float-card fc-2 glow-red">
              <div style={{ fontSize: '0.78rem', color: 'var(--text-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                AI Bot Profit · All Markets
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800 }} className="text-green">+$12,847.30</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Last 30 days · 84% win rate</div>
            </div>
            <div className="float-card fc-3 glow">
              <div className="coin-row" style={{ marginBottom: 10 }}>
                <div className="coin-icon" style={{ background: 'linear-gradient(135deg, #1f6dff, #00a2ff)' }}>FX</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>EUR / USD</div>
                  <div style={{ color: 'var(--text-mute)', fontSize: '0.8rem' }}>Forex · Major</div>
                </div>
                <div className="tag tag-buy">BOT BUY</div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Algorithm went long at 1.0842</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------- TICKER --------- */
function Ticker() {
  const items = useMemo(() => {
    const sample = [
      ...MARKETS.crypto.slice(0, 5),
      ...MARKETS.forex.slice(0, 4),
      ...MARKETS.stocks.slice(0, 5),
      ...MARKETS.indices.slice(0, 4),
      ...MARKETS.bonds.slice(0, 3),
    ];
    return [...sample, ...sample];
  }, []);
  return (
    <div className="ticker-wrap">
      <div className="ticker">
        {items.map((i, idx) => {
          const up = i.chg >= 0;
          const cls = (Object.entries(MARKETS).find(([, list]) => list.includes(i)) || [])[0] as AssetClass | undefined;
          return (
            <span className="ticker-item" key={idx}>
              <span className="symbol">{i.sym}</span>
              <span className="text-dim" style={{ fontSize: '0.78rem' }}>{(cls ?? 'crypto').toUpperCase()}</span>
              <span>{fmtPrice(cls, i.price)}</span>
              <span className={`change ${up ? 'up' : 'down'}`}>
                {up ? '▲' : '▼'} {Math.abs(i.chg).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* --------- FEATURES --------- */
function Features() {
  const features: { icon: string; title: string; body: string }[] = [
    { icon: 'fa-solid fa-robot',                title: 'AI Trading Bots',   body: 'Deep-learning bots analyse 1.2M data points per second and trade 24/7 across crypto, forex, stocks, indices and bonds.' },
    { icon: 'fa-brands fa-bitcoin',             title: 'Crypto · 250+ coins', body: 'BTC, ETH, SOL, BNB, XRP, ADA, DOGE and the long tail. Spot, perps, and staking — all from one wallet.' },
    { icon: 'fa-solid fa-money-bill-trend-up',  title: 'Forex · 60+ pairs', body: 'Trade EUR/USD, GBP/USD, USD/JPY and exotic crosses with tight institutional spreads, 24/5.' },
    { icon: 'fa-solid fa-chart-line',           title: 'Stocks · 1,000+',   body: 'Apple, Tesla, NVIDIA, Amazon and global equities — fractional shares from $1, commission-free.' },
    { icon: 'fa-solid fa-chart-pie',            title: 'Indices & Bonds',   body: 'S&P 500, NASDAQ, FTSE, DAX, NIKKEI plus US Treasuries, German Bunds, and corporate bonds.' },
    { icon: 'fa-solid fa-shield-halved',        title: 'Bank-Grade Security', body: 'Cold storage, multi-sig wallets, biometric login, and SOC 2 Type II compliance keep funds safe.' },
    { icon: 'fa-solid fa-bolt',                 title: 'Instant Deposits',  body: 'Card, bank, or crypto in seconds. Bots start working the moment funds clear.' },
    { icon: 'fa-solid fa-money-bill-transfer',  title: 'Withdraw Anytime',  body: 'No lockups. Fiat to bank or crypto to wallet — typically processed within 30 minutes.' },
  ];
  return (
    <section className="section reveal in">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Why CryptoVault</span>
          <h2>Smarter trading, <span className="gradient-text-mix">on autopilot</span></h2>
          <p>One platform for crypto, forex, stocks, indices, and bonds. Institutional infrastructure plus proprietary AI strategies.</p>
        </div>
        <div className="features-grid">
          {features.map(f => (
            <div className="feature" key={f.title}>
              <div className="feature-icon"><i className={f.icon} /></div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- HOW IT WORKS --------- */
function HowItWorks() {
  const steps = [
    { n: 1, t: 'Create an account', d: 'Sign up in 60 seconds with just an email. No paperwork, no minimums.' },
    { n: 2, t: 'Deposit funds',     d: 'Add money via card, bank, or crypto wallet. Start with as little as $50.' },
    { n: 3, t: 'Pick a strategy',   d: 'Conservative, balanced, or aggressive — our bots tune themselves to your goal.' },
    { n: 4, t: 'Earn & withdraw',   d: 'Watch profits compound in real time. Withdraw anytime, no questions asked.' },
  ];
  return (
    <section className="section" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,0,60,0.04), transparent)' }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From deposit to <span className="gradient-text">profit</span> in 4 steps</h2>
        </div>
        <div className="steps">
          {steps.map(s => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3 style={{ marginTop: 14 }}>{s.t}</h3>
              <p className="text-dim mt-sm">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- STATS BAND --------- */
function StatsBand() {
  return (
    <section className="stats-band">
      <div className="container">
        <div className="grid">
          <div><strong>$2.4B</strong><span>Trading volume</span></div>
          <div><strong>180k+</strong><span>Investors worldwide</span></div>
          <div><strong>27%</strong><span>Avg. annual yield</span></div>
          <div><strong>84%</strong><span>Bot win rate</span></div>
          <div><strong>200+</strong><span>Crypto assets</span></div>
        </div>
      </div>
    </section>
  );
}

/* --------- RISK PROFILES --------- */
function RiskProfiles() {
  const profiles = [
    { tier: 'Conservative', tag: 'SAFE',        ret: '+8-12%',  rpt: '1.0%', dd: '2.0%', focus: 'Bonds, FX',     min: '$50',  ringed: false },
    { tier: 'Balanced',     tag: 'RECOMMENDED', ret: '+15-25%', rpt: '2.5%', dd: '5.0%', focus: 'All 6 classes', min: '$50',  ringed: true  },
    { tier: 'Aggressive',   tag: 'HIGH R:R',    ret: '+25-40%', rpt: '4.0%', dd: '8.0%', focus: 'Crypto, Futures', min: '$250', ringed: false },
  ];
  return (
    <section className="section reveal in">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Pick your risk profile</span>
          <h2>One AI · <span className="gradient-text">three risk profiles.</span></h2>
          <p>Same Vault AI, three different sizing & risk parameters. Switch any time, withdraw any time.</p>
        </div>
        <div className="fund-grid">
          {profiles.map(p => (
            <div className={`fund-card ${p.ringed ? 'ring-card' : ''}`} key={p.tier}>
              <div className="fund-head">
                <div>
                  <h3>{p.tier}</h3>
                  <div className="fund-mgr">{p.tier === 'Balanced' ? 'Default · Most popular' : `${p.tier === 'Conservative' ? 'Lower' : 'Higher'} risk`}</div>
                </div>
                <span className="fund-tag">{p.tag}</span>
              </div>
              <div className="fund-roi-label">Target return</div>
              <div className="fund-roi">{p.ret}</div>
              <div className="fund-tape" />
              <div className="fund-stats">
                <div className="row"><div className="lbl">Risk per trade</div><div className="val">{p.rpt}</div></div>
                <div className="row"><div className="lbl">Daily DD limit</div><div className="val">{p.dd}</div></div>
                <div className="row"><div className="lbl">Asset focus</div><div className="val">{p.focus}</div></div>
                <div className="row"><div className="lbl">Min invest</div><div className="val">{p.min}</div></div>
              </div>
              <Link to="/signup" className={`btn ${p.ringed ? 'btn-primary' : 'btn-ghost'} btn-block`}>
                Choose {p.tier}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- HEATMAP --------- */
function Heatmap() {
  const initial = useMemo<Instrument[]>(() => [
    ...MARKETS.crypto.slice(0, 8),
    ...MARKETS.forex.slice(0, 6),
    ...MARKETS.stocks.slice(0, 8),
    ...MARKETS.indices.slice(0, 6),
    ...MARKETS.bonds.slice(0, 4),
  ].map(i => ({ ...i })), []);
  const [items, setItems] = useState<Instrument[]>(initial);

  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => prev.map(i => ({ ...tickPrice({ ...i }) })));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="section reveal in" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,162,255,0.04), transparent)' }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Live · Updates every 3s</span>
          <h2>Markets at a <span className="gradient-text-mix">glance.</span></h2>
          <p>Color-coded heatmap across crypto, forex, stocks, indices and bonds.</p>
        </div>
        <div className="heatmap">
          {items.map(i => {
            const up = i.chg >= 0;
            const intensity = Math.min(1, Math.abs(i.chg) / 6);
            const bg = up
              ? `rgba(0, 255, 163, ${0.12 + intensity * 0.55})`
              : `rgba(255, 0, 60, ${0.12 + intensity * 0.55})`;
            const cls = (Object.entries(MARKETS).find(([, list]) => list.some(x => x.sym === i.sym)) || [])[0] as AssetClass | undefined;
            return (
              <div className="heat-cell" key={i.sym} style={{ background: bg }} title={i.name}>
                <div>
                  <div className="hsym">{i.sym}</div>
                  <div className="hprice">{fmtPrice(cls, i.price)}</div>
                </div>
                <div className={`hpct ${up ? 'text-green' : 'text-red'}`}>
                  {up ? '+' : ''}{i.chg.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------- LIVE PAYOUTS (landing) --------- */
const PB_NAMES: [string, string][] = [
  ['Sarah','London,UK'],['Marcus','Austin,TX'],['Aisha','Dubai,UAE'],['Hiroshi','Tokyo,JP'],
  ['Lukas','Berlin,DE'],['Olivia','Sydney,AU'],['Mateo','Madrid,ES'],['Priya','Mumbai,IN'],
  ['Chen','Shanghai,CN'],['Eva','Stockholm,SE'],['Diego','Mexico City,MX'],['Noah','Toronto,CA'],
  ['Emma','Paris,FR'],['Lars','Oslo,NO'],['Yusuf','Istanbul,TR'],['Ananya','Bangalore,IN'],
];
interface Payout { id: number; name: string; city: string; amt: number; ago: string }
function newPayout(): Payout {
  const [name, city] = PB_NAMES[Math.floor(Math.random() * PB_NAMES.length)];
  const r = Math.random();
  const amt =
    r < 0.55 ? Math.round((200 + Math.random() * 1800) / 10) * 10 :
    r < 0.85 ? Math.round((2000 + Math.random() * 6000) / 50) * 50 :
    r < 0.97 ? Math.round((8000 + Math.random() * 18000) / 100) * 100 :
              Math.round((25000 + Math.random() * 75000) / 500) * 500;
  const m = Math.floor(Math.random() * 12) + 1;
  return { id: Date.now() + Math.random(), name, city, amt, ago: m === 1 ? 'just now' : m + 'm ago' };
}
function LivePayouts() {
  const [items, setItems] = useState<Payout[]>(() => Array.from({ length: 6 }, newPayout));
  const [total, setTotal] = useState(1842317);

  useEffect(() => {
    const id = setInterval(() => {
      const it = newPayout();
      setItems(prev => [it, ...prev].slice(0, 6));
      setTotal(t => t + it.amt);
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="section section-payouts reveal in">
      <div className="container">
        <div className="payouts-grid">
          <div>
            <span className="eyebrow" style={{
              display: 'inline-block', fontSize: '0.78rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: 'var(--green)', padding: '6px 14px',
              border: '1px solid rgba(0,255,163,0.3)', borderRadius: 999, marginBottom: 18,
              background: 'rgba(0,255,163,0.06)',
            }}>Live · paid in last 24h</span>
            <h2 style={{ marginBottom: 14 }}>
              Withdrawals hit bank accounts <span className="gradient-text">in minutes</span>, not weeks.
            </h2>
            <p className="text-dim" style={{ fontSize: '1.05rem', marginBottom: 24 }}>
              No lockups. No "review periods". When you withdraw, our treasury releases funds within 30 minutes.
            </p>
            <div className="payouts-counter-label"><span className="pulse" /> Total paid out · last 24h</div>
            <div className="payouts-counter">${total.toLocaleString()}</div>
            <div className="text-dim mt-md" style={{ fontSize: '0.95rem' }}>
              Average withdrawal time: <strong style={{ color: 'var(--text)' }}>22 min</strong> · Processed:{' '}
              <strong style={{ color: 'var(--text)' }}>3,184</strong> · Success:{' '}
              <strong className="text-green">99.97%</strong>
            </div>
          </div>
          <div className="payouts-feed">
            {items.map(it => (
              <div className="payout-row" key={it.id}>
                <div className="pa-avatar">{it.name[0]}</div>
                <div>
                  <div className="pa-who">
                    {it.name} <span className="text-mute" style={{ fontWeight: 400 }}>from {it.city}</span>
                  </div>
                  <div className="pa-meta">Withdrew to bank · {it.ago}</div>
                </div>
                <div className="pa-amt">+${it.amt.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------- ROI CALCULATOR --------- */
function ROICalculator() {
  const [amt, setAmt] = useState(5000);
  const [months, setMonths] = useState(12);
  const [profile, setProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const PROFILES = {
    conservative: { name: 'Conservative', monthly: 0.0085, yearly: 0.10 },
    balanced:     { name: 'Balanced',     monthly: 0.0165, yearly: 0.20 },
    aggressive:   { name: 'Aggressive',   monthly: 0.0245, yearly: 0.30 },
  };
  const r = PROFILES[profile].monthly;
  const fv = Math.max(50, amt) * Math.pow(1 + r, months);
  const profit = fv - Math.max(50, amt);
  const pct = ((fv / Math.max(50, amt)) - 1) * 100;
  const sliderPct = ((months - 1) / (60 - 1)) * 100;

  const fmtCash = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <section className="section reveal in">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Project your returns</span>
          <h2>See what your money <span className="gradient-text-mix">could become.</span></h2>
          <p>Based on the AI's historical performance across each risk profile. Past performance is not a guarantee of future returns.</p>
        </div>

        <div className="calc-card">
          <div className="calc-controls">
            <div className="calc-field">
              <label>Initial investment <strong>{fmtCash(Math.max(50, amt))}</strong></label>
              <input
                type="number"
                min={50}
                step={50}
                value={amt}
                onChange={e => setAmt(parseFloat(e.target.value || '0'))}
              />
            </div>
            <div className="calc-field">
              <label>Time horizon <strong>{months} month{months === 1 ? '' : 's'}</strong></label>
              <input
                type="range"
                min={1}
                max={60}
                value={months}
                style={{ ['--p' as never]: `${sliderPct}%` }}
                onChange={e => setMonths(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="calc-field">
              <label>Risk profile <strong>{PROFILES[profile].name}</strong></label>
              <div className="calc-profiles">
                {(['conservative', 'balanced', 'aggressive'] as const).map(p => (
                  <button
                    key={p}
                    className={profile === p ? 'active' : ''}
                    onClick={() => setProfile(p)}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="calc-result">
            <div className="label">Projected portfolio value</div>
            <div className="big">{fmtCash(fv)}</div>
            <div className="delta">+{fmtCash(profit)} (+{pct.toFixed(1)}%)</div>
            <div className="text-mute mt-md" style={{ fontSize: '0.8rem' }}>
              {(PROFILES[profile].yearly * 100).toFixed(0)}% APY target
            </div>
            <div className="breakdown">
              <div className="row"><span className="lbl">Min deposit</span><span className="val">$50</span></div>
              <div className="row"><span className="lbl">Withdrawal</span><span className="val text-green">Anytime</span></div>
              <div className="row"><span className="lbl">Fees on first $1k</span><span className="val text-green">$0</span></div>
              <div className="row"><span className="lbl">Performance fee</span><span className="val">15%</span></div>
            </div>
            <Link to="/signup" className="btn btn-primary btn-block mt-lg">
              Start with this plan <i className="fa-solid fa-arrow-right" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------- FAQ --------- */
function FAQ() {
  const items: { q: string; a: string }[] = [
    { q: 'Is my money actually safe?', a: 'Customer funds are held with regulated custodians (Fireblocks, BitGo) in cold storage with multi-sig wallets. CryptoVault is SOC 2 Type II certified, and digital assets are insured up to $250M per account by Lloyd\'s of London.' },
    { q: 'How fast can I withdraw?', a: 'There is no lockup. Once you click withdraw, fiat hits your bank in 22 minutes on average (US/EU/UK), and crypto withdrawals settle on-chain within 10 minutes.' },
    { q: 'What is the minimum investment?', a: '$50 to start. No paperwork, no accreditation, no income requirements — just an email and a payment method. The Aggressive profile has a $250 minimum.' },
    { q: 'How does the AI actually make money?', a: 'Vault AI runs 10 underlying strategies — trend-ADX, MACD-volume, VWAP pullbacks, order-flow imbalance, mean-reversion, breakout, and more — across 6 asset classes. It detects market regime and only enters when 2+ strategies agree at ≥72% strength with at least 3:1 R:R.' },
    { q: 'What are the fees?', a: 'Zero fees on the first $1,000 deposited. After that: 0% management fee, 15% performance fee on profits only (high-water mark model). No deposit, withdrawal, or platform fees ever.' },
    { q: 'Can I lose money?', a: 'Yes — every market-traded product carries risk. Capital is not guaranteed. Vault AI ships with a 5% daily-loss circuit breaker and per-trade stop-losses, but historical performance does not guarantee future results.' },
    { q: 'Is CryptoVault available in my country?', a: 'Available in 90+ countries including US, UK, EU, Canada, Australia, Brazil, India, Singapore, and most of Africa. We are not currently available in sanctioned jurisdictions or US states with conflicting regulation (NY, HI).' },
    { q: 'How do I get started?', a: 'Click "Get started" up top, sign up with email in 60 seconds, deposit by card / bank / crypto, pick a risk profile, and the bots take over.' },
  ];
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="section reveal in" style={{ background: 'linear-gradient(180deg, transparent, rgba(31,109,255,0.04), transparent)' }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Common questions</span>
          <h2>Everything you'd <span className="gradient-text">want to ask.</span></h2>
        </div>
        <div className="faq-list">
          {items.map((it, i) => (
            <div className={`faq-item ${openIdx === i ? 'open' : ''}`} key={i}>
              <button className="faq-q" onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
                {it.q}
                <span className="chev"><i className="fa-solid fa-chevron-down" /></span>
              </button>
              <div className="faq-a">{it.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- CTA --------- */
function CTA() {
  return (
    <section className="section" style={{ textAlign: 'center' }}>
      <div className="container">
        <div className="card glow" style={{ padding: '60px 24px', background: 'linear-gradient(135deg, rgba(255,0,60,0.1), rgba(31,109,255,0.1))', borderColor: 'var(--border-glow)' }}>
          <h2>Ready to grow your crypto?</h2>
          <p className="text-dim mt-md" style={{ fontSize: '1.05rem', maxWidth: 560, margin: '16px auto 0' }}>
            Join 180,000+ investors letting AI do the heavy lifting. No fees on your first $1,000.
          </p>
          <div className="flex gap-md" style={{ justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <Link to="/signup" className="btn btn-primary btn-lg">Create free account</Link>
            <Link to="/markets" className="btn btn-ghost btn-lg">Browse markets</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Re-export so router knows about ALL_INSTRUMENTS dependency
export const _internalUse = ALL_INSTRUMENTS;
