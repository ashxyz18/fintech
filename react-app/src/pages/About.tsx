import { Link } from 'react-router-dom';

export function About() {
  return (
    <>
      <section className="hero" style={{ minHeight: 'auto', padding: '80px 0 40px' }}>
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-badge">
                <span className="pulse" />
                <span>How CryptoVault works</span>
              </div>
              <h1>The hedge fund <span className="gradient-text">in your pocket.</span></h1>
              <p className="lead">
                One unified AI manager runs your portfolio across 6 asset classes. You deposit; it trades.
                When you want out, you withdraw. No lockups, no minimums, no fund manager fees.
              </p>
              <div className="hero-cta">
                <Link to="/signup" className="btn btn-primary btn-lg">
                  Open an account <i className="fa-solid fa-arrow-right" />
                </Link>
                <Link to="/trading" className="btn btn-ghost btn-lg">
                  <i className="fa-solid fa-circle-play" /> See bots live
                </Link>
              </div>
            </div>
            <div className="hero-visual">
              <div className="float-card fc-1 glow">
                <div style={{ fontSize: '0.78rem', color: 'var(--text-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Live Vault AI
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }} className="text-green">53.7% win rate</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Profit factor 3.14 · Avg R:R 2.67:1</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">In four steps</span>
            <h2>How your money works <span className="gradient-text-mix">at CryptoVault</span></h2>
          </div>
          <div className="steps">
            {[
              { n: 1, t: 'You deposit',    d: 'Card / bank / crypto. Funds land in your main wallet — your withdrawable cash.' },
              { n: 2, t: 'You allocate',   d: 'Move what you want to invest into your trading wallet. Pick a risk profile.' },
              { n: 3, t: 'AI trades 24/7', d: 'Vault AI runs 10 strategies across 6 asset classes, regime-adaptive, with strict risk controls.' },
              { n: 4, t: 'You withdraw',   d: 'Anytime. To bank or wallet. Average payout time 22 minutes.' },
            ].map(s => (
              <div className="step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <h3 style={{ marginTop: 14 }}>{s.t}</h3>
                <p className="text-dim mt-sm">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,162,255,0.04), transparent)' }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Under the hood</span>
            <h2>Built with <span className="gradient-text">institutional rigour</span></h2>
          </div>
          <div className="features-grid">
            {[
              { icon: 'fa-shield-halved', t: 'Cold-storage custody',   b: 'Funds with regulated custodians (Fireblocks, BitGo). Multi-sig wallets. SOC 2 Type II.' },
              { icon: 'fa-fingerprint',   t: 'Auditable on-chain trades', b: 'Every AI decision is logged with its 8-step reasoning chain. Click any trade to inspect.' },
              { icon: 'fa-rotate',        t: 'Continuously backtested', b: 'Backtests itself on 1,500 bars across 6 regimes. Auto-tunes when expectancy drifts.' },
              { icon: 'fa-bolt',          t: 'Sub-second execution',    b: 'Co-located gateways into all major venues. Spreads tight enough to actually capture edge.' },
              { icon: 'fa-globe',         t: 'Regime-adaptive',          b: 'Trend, range, volatile — different strategy mix per regime. Stands down when uncertain.' },
              { icon: 'fa-circle-info',   t: 'Transparent fees',        b: '0% management. 15% performance fee on profits only, with high-water mark. No surprises.' },
            ].map(f => (
              <div key={f.t} className="feature">
                <div className="feature-icon"><i className={`fa-solid ${f.icon}`} /></div>
                <h3>{f.t}</h3>
                <p>{f.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container">
          <div className="card glow" style={{ padding: '60px 24px', background: 'linear-gradient(135deg, rgba(255,0,60,0.1), rgba(31,109,255,0.1))', borderColor: 'var(--border-glow)' }}>
            <h2>Ready to start?</h2>
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
    </>
  );
}
