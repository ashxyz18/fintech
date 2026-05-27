# CryptoVault — AI-Powered Multi-Asset Trading Platform

> The first AI-driven hedge fund open to everyone. One unified AI manages crypto, forex, stocks, indices, bonds, and futures — with explainable, regime-adaptive reasoning on every trade.

## What's inside

A complete, self-contained static demo (no backend, no build step) that ships:

| Page | What it does |
| --- | --- |
| `index.html` | Landing page · video hero, live ticker, market heatmap, AI manager card, risk-profile cards, FAQ |
| `signup.html` / `login.html` | Split-screen auth with localStorage demo session |
| `dashboard.html` | Main + Trading wallets, portfolio chart, allocation doughnut, holdings, full trade history, quick-trade form, transfer modal |
| `markets.html` | Live-updating prices for 6 asset classes, sparklines, fundamental badges, instrument detail panel with mini-chart |
| `trading.html` | Live AI bot view: equity curve, reasoning feed (8-step chain-of-thought per trade), open positions with SL/TP, run-backtest + auto-tune buttons |
| `deposit.html` / `withdraw.html` | Multi-method funding (card, bank, BTC, ETH, USDT, Apple Pay, PayPal) with QR codes and previews |
| `about.html` | Hedge-fund pitch, 10-strategy deep dive, multi-regime performance table, fees, FAQ |

## The AI engine — `js/algo.js`

A single `MasterAI` class manages every position. The engine:

- Detects market regime (TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE)
- Switches strategy mix and risk parameters per regime automatically
- Requires 2+ independent strategies to agree before opening a position
- Snapshots SL/TP per-position so config changes don't disrupt open trades
- Logs an 8-step **AI chain-of-thought** on every entry

### 10 strategies available

1. `trendADX` — EMA cross filtered by ADX strength
2. `bbReversion` — Bollinger band extremes + RSI
3. `macdVolume` — MACD histogram + OBV confirmation
4. `vwapPullback` — VWAP retest in trend direction
5. `orderFlow` — Bid/ask volume imbalance
6. `liquiditySweep` — SMC stop-loss-hunt detector
7. `orderBlock` — SMC last-opposite-candle retest
8. `supplyDemand` — SMC swing-zone retest
9. `trendlineBreak` — Price-action break of swing-derived trendlines
10. `engulfing` — Engulfing pattern at swing extremes

### Verified performance (5 runs × 1500 bars × 10 instruments)

| Metric | Value |
| --- | ---:|
| Win rate | **57.8%** |
| Avg R:R | 2.25:1 |
| Profit factor | **3.09** |
| Net PnL | **+$1,461 (+14.6%)** |

Run `node tools/test-algo.js` and `node tools/test-master.js` to reproduce. Full results in `tools/BACKTEST_RESULTS.md`.

## File structure

```
fintech/
├── index.html              landing
├── signup.html / login.html auth
├── dashboard.html          main app
├── markets.html            live markets
├── trading.html            AI bot live view
├── deposit.html / withdraw.html
├── about.html              how-it-works
├── css/style.css           ~1300 lines, red/black/blue crypto theme
├── js/
│   ├── data.js             6 asset classes, ASSET_META, fmt helpers
│   ├── main.js             nav, ticker, heatmap, auth state, toasts, scroll reveal
│   ├── algo.js             AlgoBot + MasterAI + 10 strategies + indicators + regime detector + backtest harness
│   └── dashboard.js        dashboard rendering + live bot feed
└── tools/
    ├── test-algo.js        standard 1500-bar benchmark
    ├── test-master.js      6-regime stress test
    └── BACKTEST_RESULTS.md verified output
```

## Demo

This is a frontend-only demo. Open `index.html` in a browser. Data persists to `localStorage` under keys `cv_user` (auth) and `cv_account` (account state). Use any email + 6+ char password to sign up.

## Disclaimer

Past performance does not guarantee future results. All numbers come from backtests on synthetic OHLC data with realistic regime shifts and noise — not real-money trading.
