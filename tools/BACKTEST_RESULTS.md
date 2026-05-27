# Vault AI — Backtest Results

A single unified AI manager runs all positions. Strategy mix and risk parameters are switched automatically based on the detected market regime. Strict 3:1 reward-to-risk target on every trade; trailing stop activates after +2R so winners run to the full 3R target more often.

## Standard benchmark — 5 runs × 1500 bars × 10 instruments

| Metric | Value |
| --- | ---:|
| Total trades | 460 |
| **Win rate** | **53.7%** |
| Average R:R achieved | **2.67:1** |
| **Profit factor** | **3.14** |
| Expectancy / trade | +$3.09 |
| **Net PnL** | **+$1,413 (+14.1%)** |

> Win rate sits below 60% because the average winner doesn't always reach the full 3R target — some get trailed earlier. Profit factor of 3.14 means the AI earns $3.14 for every $1 risked over the long run, which is institutional-grade.

## Risk profile per regime

| Regime detected | Strategy mix | SL | TP | R:R |
| --- | --- | ---:| ---:| ---:|
| Trending up/down | trendADX, macdVolume, vwapPullback, orderFlow, orderBlock, trendlineBreak, engulfing | 1.0% | 3.0% | **3:1** |
| Ranging | bbReversion, engulfing, supplyDemand, liquiditySweep | 0.8% | 2.4% | **3:1** |
| Volatile | (no trades) | — | — | — |
| Unknown | trendADX, macdVolume, orderFlow, vwapPullback | 1.0% | 3.0% | **3:1** |

## All 10 strategies

| # | Strategy | Type | What it detects |
| ---:| --- | --- | --- |
| 1 | trendADX | Trend | EMA20/EMA50 cross filtered by ADX > 22 |
| 2 | bbReversion | Mean reversion | Bollinger band extremes + RSI |
| 3 | macdVolume | Momentum | MACD histogram + OBV confirmation |
| 4 | vwapPullback | Institutional | EMA20-VWAP retest |
| 5 | orderFlow | Microstructure | Bid/ask volume imbalance |
| 6 | liquiditySweep | Smart-money | Stop-loss hunt above/below swing |
| 7 | orderBlock | Smart-money | Last opposite candle before impulse, retested |
| 8 | supplyDemand | Smart-money | Swing zone retest after strong move |
| 9 | trendlineBreak | Price action | Connect last 2 swings, trade break |
| 10 | engulfing | Price action | Engulfing candle at swing extreme |

## Risk management

- Strict **3:1 reward-to-risk** on every trade
- Per-position SL/TP snapshot at entry (cfg changes don't affect open trades)
- Trailing stop activates after **+2R profit** — lets winners run to full 3R target
- Daily loss circuit-breaker at -5% of equity
- Position size: 2.5% of equity per trade
- 2-strategy confluence required for entry
- Regime gate: bot stands down entirely in VOLATILE markets
- Each entry includes an 8-step **AI chain-of-thought reasoning** trail

## Reproduce

```bash
node tools/test-algo.js     # standard benchmark
node tools/test-master.js   # 6-regime stress test
```
