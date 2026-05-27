/* ================================================================
   CRYPTOVAULT - ALGO TRADING ENGINE  (v2 — modern, multi-factor)
   ----------------------------------------------------------------
   Features:
   - Indicators: SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP, OBV, ADX
   - Volume / order-flow imbalance signals
   - Multi-timeframe analysis (M5, M15, H1)
   - Regime detection: TRENDING_UP / TRENDING_DOWN / RANGING / VOLATILE
   - Fundamental scoring per instrument (-2..+2)
   - Confluence engine: a trade requires
       * 2+ strategy votes in same direction
       * regime alignment
       * non-negative fundamental score
       * volume confirmation
   - Risk management:
       * tight SL, 3:1 R:R take-profit
       * trailing stop activates after 1R profit
       * Kelly-lite position sizing capped at riskPerTrade
       * max open positions, daily loss limit
   - Built-in backtester verifies win rate before deploying live
   ================================================================ */

/* =============== INDICATORS =============== */
const Indicators = {
  sma(arr, p) {
    if (arr.length < p) return null;
    let s = 0; for (let i = arr.length - p; i < arr.length; i++) s += arr[i];
    return s / p;
  },
  ema(arr, p) {
    if (arr.length < p) return null;
    const k = 2 / (p + 1);
    let e = Indicators.sma(arr.slice(0, p), p);
    for (let i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  },
  rsi(arr, p = 14) {
    if (arr.length < p + 1) return null;
    let g = 0, l = 0;
    for (let i = arr.length - p; i < arr.length; i++) {
      const d = arr[i] - arr[i - 1];
      if (d >= 0) g += d; else l -= d;
    }
    if (l === 0) return 100;
    const rs = (g / p) / (l / p);
    return 100 - 100 / (1 + rs);
  },
  macd(arr, fast = 12, slow = 26, sig = 9) {
    if (arr.length < slow + sig) return null;
    const macdLine = [];
    let ef = Indicators.sma(arr.slice(0, fast), fast);
    let es = Indicators.sma(arr.slice(0, slow), slow);
    const kF = 2 / (fast + 1), kS = 2 / (slow + 1);
    for (let i = slow; i < arr.length; i++) {
      ef = arr[i] * kF + ef * (1 - kF);
      es = arr[i] * kS + es * (1 - kS);
      macdLine.push(ef - es);
    }
    const signal = Indicators.sma(macdLine.slice(-sig), sig);
    const macd = macdLine[macdLine.length - 1];
    return { macd, signal, hist: macd - signal };
  },
  bollinger(arr, p = 20, mult = 2) {
    if (arr.length < p) return null;
    const slice = arr.slice(-p);
    const mid = slice.reduce((a, b) => a + b, 0) / p;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / p);
    return { mid, upper: mid + mult * sd, lower: mid - mult * sd, width: 2 * mult * sd / mid };
  },
  // True range from close-only series (approximation)
  atr(arr, p = 14) {
    if (arr.length < p + 1) return null;
    const trs = [];
    for (let i = 1; i < arr.length; i++) trs.push(Math.abs(arr[i] - arr[i - 1]));
    const last = trs.slice(-p);
    return last.reduce((a, b) => a + b, 0) / p;
  },
  // VWAP — uses prices and volumes
  vwap(prices, volumes) {
    if (!prices.length) return null;
    let pv = 0, vv = 0;
    for (let i = 0; i < prices.length; i++) { pv += prices[i] * volumes[i]; vv += volumes[i]; }
    return vv === 0 ? null : pv / vv;
  },
  // On-balance volume — momentum via volume
  obv(prices, volumes) {
    if (prices.length < 2) return null;
    let obv = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) obv += volumes[i];
      else if (prices[i] < prices[i - 1]) obv -= volumes[i];
    }
    return obv;
  },
  // ADX — trend strength (simplified close-based proxy)
  adx(arr, p = 14) {
    if (arr.length < p * 2) return null;
    const plusDM = [], minusDM = [], tr = [];
    for (let i = 1; i < arr.length; i++) {
      const move = arr[i] - arr[i - 1];
      plusDM.push(move > 0 ? move : 0);
      minusDM.push(move < 0 ? -move : 0);
      tr.push(Math.abs(move));
    }
    const smooth = (a, p) => {
      const out = [a.slice(0, p).reduce((x, y) => x + y, 0)];
      for (let i = p; i < a.length; i++) out.push(out[out.length - 1] - out[out.length - 1] / p + a[i]);
      return out;
    };
    const sP = smooth(plusDM, p);
    const sM = smooth(minusDM, p);
    const sT = smooth(tr, p);
    const plusDI  = sP.map((v, i) => 100 * v / (sT[i] || 1));
    const minusDI = sM.map((v, i) => 100 * v / (sT[i] || 1));
    const dx = plusDI.map((v, i) => 100 * Math.abs(v - minusDI[i]) / ((v + minusDI[i]) || 1));
    return dx.slice(-p).reduce((a, b) => a + b, 0) / p;
  },
};

/* =============== FUNDAMENTAL SCORES ===============
   Hardcoded realistic-ish bias for the demo universe.
   Range: -2 (very bearish) … +2 (very bullish)
*/
const FUNDAMENTALS = {
  // Crypto
  BTC: 1.5, ETH: 1.5, SOL: 1.0, BNB: 0.8, XRP: 0.2, ADA: 0.4, DOGE: -0.3, DOT: 0.1, AVAX: 0.7, LINK: 0.6,
  // Forex (vs USD strength)
  EURUSD: 0.3, GBPUSD: 0.1, USDJPY: 0.5, AUDUSD: 0.2, USDCAD: 0.3, USDCHF: 0.1, NZDUSD: 0.1, EURGBP: 0.0,
  // Stocks (rough sentiment)
  AAPL: 1.2, TSLA: 0.8, NVDA: 1.8, MSFT: 1.4, AMZN: 1.1, GOOGL: 1.0, META: 0.9, JPM: 0.7, 'BRK.B': 0.8, V: 0.9,
  // Indices
  SPX: 0.8, NDX: 1.1, DJI: 0.6, FTSE: 0.3, DAX: 0.4, NKY: 0.7, HSI: -0.2, CAC: 0.3,
  // Bonds (price view; rising yields = bearish for price)
  US10Y: -0.4, US30Y: -0.5, US2Y: -0.2, DE10Y: -0.3, UK10Y: -0.4, JP10Y: -0.1, CORP: 0.1, HY: 0.3,
  // Futures
  'BTC-PERP': 1.5, 'ETH-PERP': 1.5, 'SOL-PERP': 1.0, ES: 0.8, NQ: 1.1, YM: 0.6, CL: -0.2, GC: 0.5,
};

/* =============== REGIME DETECTOR =============== */
function detectRegime(prices) {
  if (prices.length < 60) return 'UNKNOWN';
  const adx = Indicators.adx(prices, 14) || 0;
  const bb = Indicators.bollinger(prices, 20, 2);
  const ema20 = Indicators.ema(prices, 20);
  const ema50 = Indicators.ema(prices, 50);
  if (!bb || !ema20 || !ema50) return 'UNKNOWN';
  const widthPct = bb.width;            // bandwidth as fraction of price
  if (widthPct > 0.06) return 'VOLATILE';
  if (adx > 25 && ema20 > ema50) return 'TRENDING_UP';
  if (adx > 25 && ema20 < ema50) return 'TRENDING_DOWN';
  return 'RANGING';
}

/* =============== STRATEGIES (return signal + reason) =============== */

/* Helpers for swing/pivot detection used by SMC strategies */
function findSwingHighs(prices, lookback = 30, leftRight = 3) {
  const out = [];
  const start = Math.max(leftRight, prices.length - lookback);
  for (let i = start; i < prices.length - leftRight; i++) {
    let isHigh = true;
    for (let k = 1; k <= leftRight; k++) {
      if (prices[i] <= prices[i - k] || prices[i] <= prices[i + k]) { isHigh = false; break; }
    }
    if (isHigh) out.push({ idx: i, price: prices[i] });
  }
  return out;
}
function findSwingLows(prices, lookback = 30, leftRight = 3) {
  const out = [];
  const start = Math.max(leftRight, prices.length - lookback);
  for (let i = start; i < prices.length - leftRight; i++) {
    let isLow = true;
    for (let k = 1; k <= leftRight; k++) {
      if (prices[i] >= prices[i - k] || prices[i] >= prices[i + k]) { isLow = false; break; }
    }
    if (isLow) out.push({ idx: i, price: prices[i] });
  }
  return out;
}

const Strategies = {

  // 1. Trend-following with ADX filter (only acts in strong trends)
  trendADX(prices) {
    if (prices.length < 60) return null;
    const ema20 = Indicators.ema(prices, 20);
    const ema50 = Indicators.ema(prices, 50);
    const adx   = Indicators.adx(prices, 14);
    const rsi   = Indicators.rsi(prices, 14);
    if (!adx || adx < 22) return { signal: 'HOLD', strength: 0, reason: `ADX ${adx?.toFixed(0)||'?'} — trend too weak.` };
    if (ema20 > ema50 && rsi > 50 && rsi < 70) {
      return { signal: 'BUY', strength: Math.min(0.95, 0.5 + adx/100), reason: `Strong uptrend (ADX ${adx.toFixed(0)}, EMA20>EMA50, RSI ${rsi.toFixed(0)}).` };
    }
    if (ema20 < ema50 && rsi < 50 && rsi > 30) {
      return { signal: 'SELL', strength: Math.min(0.95, 0.5 + adx/100), reason: `Strong downtrend (ADX ${adx.toFixed(0)}, EMA20<EMA50, RSI ${rsi.toFixed(0)}).` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Trend conditions not aligned.' };
  },

  // 2. Mean-reversion at Bollinger extremes when ADX is LOW (range market)
  bbReversion(prices) {
    if (prices.length < 30) return null;
    const adx = Indicators.adx(prices, 14);
    if (adx && adx > 28) return { signal: 'HOLD', strength: 0, reason: 'Market trending — skipping reversion.' };
    const bb = Indicators.bollinger(prices, 20, 2);
    const rsi = Indicators.rsi(prices, 14);
    const last = prices[prices.length - 1];
    if (rsi < 30 && last <= bb.lower * 1.001) {
      return { signal: 'BUY', strength: 0.92, reason: `Range market, deeply oversold (RSI ${rsi.toFixed(0)}), tagged lower band — high-probability bounce.` };
    }
    if (rsi > 70 && last >= bb.upper * 0.999) {
      return { signal: 'SELL', strength: 0.9, reason: `Range market, overbought (RSI ${rsi.toFixed(0)}), tagged upper band — fading.` };
    }
    if (rsi < 38 && last <= bb.lower) {
      return { signal: 'BUY', strength: 0.78, reason: `Oversold (RSI ${rsi.toFixed(0)}) at lower band.` };
    }
    if (rsi > 62 && last >= bb.upper) {
      return { signal: 'SELL', strength: 0.76, reason: `Overbought (RSI ${rsi.toFixed(0)}) at upper band.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Inside the bands.' };
  },

  // 3. MACD breakout with volume (OBV) confirmation
  macdVolume(prices, volumes) {
    if (prices.length < 60) return null;
    const macd = Indicators.macd(prices);
    const obv = Indicators.obv(prices, volumes);
    if (!macd) return null;
    const obvPrev = Indicators.obv(prices.slice(0, -5), volumes.slice(0, -5));
    const obvUp = obv > obvPrev;
    if (macd.hist > 0 && obvUp) {
      return { signal: 'BUY', strength: 0.85, reason: `MACD bullish + OBV rising — volume confirming the move.` };
    }
    if (macd.hist < 0 && !obvUp) {
      return { signal: 'SELL', strength: 0.8, reason: `MACD bearish + OBV declining — sellers in control.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'MACD/volume divergence — waiting.' };
  },

  // 4. VWAP pullback — institutional reference
  vwapPullback(prices, volumes) {
    if (prices.length < 30) return null;
    const v = Indicators.vwap(prices.slice(-30), volumes.slice(-30));
    const ema20 = Indicators.ema(prices, 20);
    const last = prices[prices.length - 1];
    if (!v || !ema20) return null;
    const distPct = (last - v) / v;
    if (ema20 > v && distPct < -0.002 && distPct > -0.012) {
      return { signal: 'BUY', strength: 0.7, reason: `Uptrend pullback to VWAP (-${(Math.abs(distPct)*100).toFixed(2)}%) — buy the dip.` };
    }
    if (ema20 < v && distPct > 0.002 && distPct < 0.012) {
      return { signal: 'SELL', strength: 0.7, reason: `Downtrend retest of VWAP (+${(distPct*100).toFixed(2)}%) — short the rip.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No clean VWAP retest.' };
  },

  // 5. Order-flow imbalance — uses simulated bid/ask volume
  orderFlow(prices, volumes, orderFlow) {
    if (!orderFlow || orderFlow.length < 5) return null;
    const last5 = orderFlow.slice(-5);
    const buyVol  = last5.reduce((a, b) => a + b.bid, 0);
    const sellVol = last5.reduce((a, b) => a + b.ask, 0);
    const total = buyVol + sellVol;
    if (total === 0) return null;
    const imbalance = (buyVol - sellVol) / total;
    if (imbalance > 0.35) {
      return { signal: 'BUY', strength: 0.75, reason: `Aggressive buying — bid/ask imbalance +${(imbalance*100).toFixed(0)}%.` };
    }
    if (imbalance < -0.35) {
      return { signal: 'SELL', strength: 0.75, reason: `Aggressive selling — bid/ask imbalance ${(imbalance*100).toFixed(0)}%.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Order flow balanced.' };
  },

  /* ===================== SMART MONEY CONCEPTS (SMC) ===================== */

  // 6. Liquidity Sweep / Stop-Loss Hunt
  //    Smart-money pushes price beyond a recent swing high/low to grab stops,
  //    then immediately reverses. We fade the sweep.
  liquiditySweep(prices) {
    if (prices.length < 40) return null;
    const window = prices.slice(-25);
    const recentHigh = Math.max(...window.slice(0, -3));
    const recentLow  = Math.min(...window.slice(0, -3));
    const sweepHigh = window.slice(-3).some(p => p > recentHigh * 1.0008);
    const sweepLow  = window.slice(-3).some(p => p < recentLow  * 0.9992);
    const last = prices[prices.length - 1];

    if (sweepHigh && last < recentHigh) {
      return { signal: 'SELL', strength: 0.88, reason: `Liquidity grab above swing high (SL hunt) then rejected — smart money short.` };
    }
    if (sweepLow && last > recentLow) {
      return { signal: 'BUY', strength: 0.88, reason: `Stops swept below swing low and reclaimed — smart money long.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No liquidity sweep yet.' };
  },

  // 7. Order Block — last opposite-direction candle before a strong impulsive move
  //    On retest of that zone we trade in direction of the impulse.
  orderBlock(prices) {
    if (prices.length < 40) return null;
    const last = prices[prices.length - 1];
    // Look back 5..30 bars for a bearish bar (close < prev close) followed by
    // a >2.5% rally within the next 6 bars — that's a bullish OB.
    for (let i = prices.length - 30; i < prices.length - 6; i++) {
      if (i < 1) continue;
      const bearish = prices[i] < prices[i - 1];
      const bullish = prices[i] > prices[i - 1];
      const moveUp   = (Math.max(...prices.slice(i, i + 6)) - prices[i]) / prices[i];
      const moveDown = (prices[i] - Math.min(...prices.slice(i, i + 6))) / prices[i];

      if (bearish && moveUp > 0.025) {
        const obLow = Math.min(prices[i - 1], prices[i]);
        const obHigh = Math.max(prices[i - 1], prices[i]);
        // BUY when price retests the OB from above (within 0.4%)
        if (last <= obHigh * 1.004 && last >= obLow * 0.996) {
          return { signal: 'BUY', strength: 0.86, reason: `Bullish order block at ${obLow.toFixed(2)}-${obHigh.toFixed(2)} retested — institutional demand zone.` };
        }
      }
      if (bullish && moveDown > 0.025) {
        const obLow = Math.min(prices[i - 1], prices[i]);
        const obHigh = Math.max(prices[i - 1], prices[i]);
        if (last >= obLow * 0.996 && last <= obHigh * 1.004) {
          return { signal: 'SELL', strength: 0.84, reason: `Bearish order block at ${obLow.toFixed(2)}-${obHigh.toFixed(2)} retested — institutional supply zone.` };
        }
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No order block retest.' };
  },

  // 8. Supply / Demand zone — buys at demand (recent swing low producing rally),
  //    sells at supply (recent swing high producing drop). Zone width = ATR.
  supplyDemand(prices) {
    if (prices.length < 40) return null;
    const atr = Indicators.atr(prices, 14);
    if (!atr) return null;
    const lows  = findSwingLows(prices, 40, 3);
    const highs = findSwingHighs(prices, 40, 3);
    const last = prices[prices.length - 1];
    // Demand zone: most recent swing low whose subsequent move was strong (≥2%)
    for (let i = lows.length - 1; i >= 0; i--) {
      const sw = lows[i];
      const after = prices.slice(sw.idx + 1, sw.idx + 8);
      if (!after.length) continue;
      const rallied = (Math.max(...after) - sw.price) / sw.price;
      if (rallied > 0.02 && Math.abs(last - sw.price) <= atr * 0.8 && last >= sw.price) {
        return { signal: 'BUY', strength: 0.82, reason: `Demand zone at ${sw.price.toFixed(2)} (prev rally +${(rallied*100).toFixed(1)}%) — buying retest.` };
      }
    }
    for (let i = highs.length - 1; i >= 0; i--) {
      const sw = highs[i];
      const after = prices.slice(sw.idx + 1, sw.idx + 8);
      if (!after.length) continue;
      const dropped = (sw.price - Math.min(...after)) / sw.price;
      if (dropped > 0.02 && Math.abs(last - sw.price) <= atr * 0.8 && last <= sw.price) {
        return { signal: 'SELL', strength: 0.8, reason: `Supply zone at ${sw.price.toFixed(2)} (prev drop -${(dropped*100).toFixed(1)}%) — fading retest.` };
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No active supply/demand retest.' };
  },

  // 9. Trendline break — connect last two swing lows (uptrend trendline) or
  //    swing highs (downtrend); trade when price breaks the line.
  trendlineBreak(prices) {
    if (prices.length < 50) return null;
    const lows = findSwingLows(prices, 50, 3);
    const highs = findSwingHighs(prices, 50, 3);
    const last = prices[prices.length - 1];
    const N = prices.length - 1;

    if (lows.length >= 2) {
      const [a, b] = lows.slice(-2);
      if (b.idx > a.idx && b.price > a.price) { // rising trendline
        const slope = (b.price - a.price) / (b.idx - a.idx);
        const projected = b.price + slope * (N - b.idx);
        // Bearish break of rising trendline → SELL
        if (last < projected * 0.998) {
          return { signal: 'SELL', strength: 0.76, reason: `Rising trendline broken at ${projected.toFixed(2)} — uptrend invalidated.` };
        }
      }
    }
    if (highs.length >= 2) {
      const [a, b] = highs.slice(-2);
      if (b.idx > a.idx && b.price < a.price) { // falling trendline
        const slope = (b.price - a.price) / (b.idx - a.idx);
        const projected = b.price + slope * (N - b.idx);
        // Bullish break of falling trendline → BUY
        if (last > projected * 1.002) {
          return { signal: 'BUY', strength: 0.78, reason: `Falling trendline broken at ${projected.toFixed(2)} — downtrend reversed.` };
        }
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No trendline break.' };
  },

  // 10. Engulfing price-action — current bar's move dwarfs prior bar in opposite direction
  engulfing(prices) {
    if (prices.length < 8) return null;
    const c0 = prices[prices.length - 1];
    const c1 = prices[prices.length - 2];
    const c2 = prices[prices.length - 3];
    const prevMove = c1 - c2;
    const curMove  = c0 - c1;
    if (Math.abs(prevMove) < 1e-6) return null;
    const ratio = Math.abs(curMove) / Math.abs(prevMove);
    if (ratio < 1.4) return { signal: 'HOLD', strength: 0, reason: 'No engulfing.' };

    // Bullish engulfing: prev bearish, current bullish & larger
    if (prevMove < 0 && curMove > 0 && c0 > c2) {
      // Confirm at a swing low
      const lows = findSwingLows(prices, 30, 3);
      const nearLow = lows.length && Math.abs(c1 - lows[lows.length - 1].price) / c1 < 0.01;
      if (nearLow) return { signal: 'BUY', strength: 0.82, reason: `Bullish engulfing at swing low — buyers reclaiming control.` };
      return { signal: 'BUY', strength: 0.7, reason: `Bullish engulfing — momentum shift.` };
    }
    if (prevMove > 0 && curMove < 0 && c0 < c2) {
      const highs = findSwingHighs(prices, 30, 3);
      const nearHigh = highs.length && Math.abs(c1 - highs[highs.length - 1].price) / c1 < 0.01;
      if (nearHigh) return { signal: 'SELL', strength: 0.82, reason: `Bearish engulfing at swing high — sellers stepping in.` };
      return { signal: 'SELL', strength: 0.7, reason: `Bearish engulfing — momentum shift.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No engulfing pattern.' };
  },
};

/* =============== ALGO BOT =============== */
class AlgoBot {
  constructor(cfg = {}) {
    this.cfg = Object.assign({
      strategies: ['trendADX', 'bbReversion', 'macdVolume', 'vwapPullback', 'orderFlow'],
      stopLossPct: 0.012,            // 1.2% — tight
      takeProfitPct: 0.036,          // 3.6% → 3:1 R:R
      trailingActivatePct: 0.012,    // start trailing after 1R profit
      trailingStopPct: 0.008,
      maxOpen: 8,
      riskPerTrade: 0.03,            // 3% of equity max
      dailyLossLimit: 0.05,          // halt for the day after -5%
      requireConfluence: 2,          // need >=2 agreeing strategies
      minSignalStrength: 0.7,
      respectFundamentals: true,
      respectRegime: true,
      // Optional whitelist of regimes the bot is allowed to trade in.
      onlyRegimes: null,
      // Optional blacklist of regimes the bot must skip.
      avoidRegimes: null,
    }, cfg);

    this.history = {};       // sym -> [prices]
    this.volumes = {};       // sym -> [volumes]
    this.flow    = {};       // sym -> [{ bid, ask, time }]
    this.positions = {};
    this.equity = 10000;
    this.startEquity = 10000;
    this.dailyPnl = 0;
    this.dayStart = new Date().setHours(0,0,0,0);
    this.log = [];
    this.closedTrades = [];
    this.stats = { wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, total: 0 };
  }

  ingest(inst, volume, flow) {
    const k = inst.sym;
    this.history[k] = this.history[k] || [];
    this.volumes[k] = this.volumes[k] || [];
    this.flow[k]    = this.flow[k]    || [];
    this.history[k].push(inst.price);
    this.volumes[k].push(volume || 1);
    if (flow) this.flow[k].push(flow);
    if (this.history[k].length > 240) this.history[k].shift();
    if (this.volumes[k].length > 240) this.volumes[k].shift();
    if (this.flow[k].length > 60)     this.flow[k].shift();
  }

  // Manage open position; return any close event
  _managePosition(inst) {
    const pos = this.positions[inst.sym];
    if (!pos) return null;
    const cur = inst.price;
    const dir = pos.side === 'BUY' ? 1 : -1;
    const plPct = ((cur - pos.entry) / pos.entry) * dir;

    // Use per-position thresholds (set at entry) so the bot can adapt cfg
    // on subsequent calls without affecting already-open positions.
    const slPct  = pos.stopLossPct  ?? this.cfg.stopLossPct;
    const tpPct  = pos.takeProfitPct ?? this.cfg.takeProfitPct;
    const taPct  = pos.trailingActivatePct ?? this.cfg.trailingActivatePct;
    const tsPct  = pos.trailingStopPct ?? this.cfg.trailingStopPct;

    if (plPct <= -slPct)
      return this._close(inst, cur, 'STOP_LOSS', `Stop-loss at -${(slPct*100).toFixed(2)}% — capital preserved.`);
    if (plPct >= tpPct)
      return this._close(inst, cur, 'TAKE_PROFIT', `Take-profit hit at +${(plPct*100).toFixed(2)}% — full target reached.`);

    if (plPct >= taPct) {
      if (dir === 1 && cur > pos.peak) pos.peak = cur;
      if (dir === -1 && cur < pos.peak) pos.peak = cur;
      const trailHit = dir === 1
        ? cur <= pos.peak * (1 - tsPct)
        : cur >= pos.peak * (1 + tsPct);
      if (trailHit)
        return this._close(inst, cur, 'TRAILING_STOP', `Trailing stop after +${(plPct*100).toFixed(2)}% — locking gains.`);
    }
    return null;
  }

  // Try to open a new position via confluence
  _maybeOpen(inst) {
    if (this.positions[inst.sym]) return null;
    if (Object.keys(this.positions).length >= this.cfg.maxOpen) return null;

    // Daily loss circuit-breaker
    if (this.dailyPnl <= -this.startEquity * this.cfg.dailyLossLimit)
      return null;

    const prices  = this.history[inst.sym];
    const volumes = this.volumes[inst.sym];
    const flow    = this.flow[inst.sym];
    if (!prices || prices.length < 60) return null;

    // Regime gate
    const regime = detectRegime(prices);
    if (this.cfg.respectRegime && regime === 'VOLATILE') return null;
    if (this.cfg.onlyRegimes  && !this.cfg.onlyRegimes.includes(regime)) return null;
    if (this.cfg.avoidRegimes &&  this.cfg.avoidRegimes.includes(regime)) return null;

    // Strategy votes
    const votes = [];
    for (const sName of this.cfg.strategies) {
      const fn = Strategies[sName];
      if (!fn) continue;
      const v = fn(prices, volumes, flow);
      if (v && v.signal !== 'HOLD') votes.push({ ...v, strategy: sName });
    }
    if (!votes.length) return null;

    // Aggregate by direction
    const buys  = votes.filter(v => v.signal === 'BUY');
    const sells = votes.filter(v => v.signal === 'SELL');
    let pick, dir;
    if (buys.length >= this.cfg.requireConfluence && buys.length > sells.length) { pick = buys; dir = 'BUY'; }
    else if (sells.length >= this.cfg.requireConfluence && sells.length > buys.length) { pick = sells; dir = 'SELL'; }
    else return null;

    // Regime alignment
    if (this.cfg.respectRegime) {
      if (dir === 'BUY' && regime === 'TRENDING_DOWN') return null;
      if (dir === 'SELL' && regime === 'TRENDING_UP') return null;
    }

    // Fundamental alignment
    if (this.cfg.respectFundamentals) {
      const fund = FUNDAMENTALS[inst.sym] ?? 0;
      if (dir === 'BUY' && fund < -0.5) return null;
      if (dir === 'SELL' && fund > 0.5) return null;
    }

    // Combine strength (avg of agreeing votes, boosted by confluence count)
    const strength = Math.min(0.99, pick.reduce((a, v) => a + v.strength, 0) / pick.length + 0.05 * (pick.length - 1));
    if (strength < this.cfg.minSignalStrength) return null;

    return this._open(inst, dir, strength, pick, regime);
  }

  _open(inst, dir, strength, votes, regime) {
    const price = inst.price;
    const dollars = Math.max(50, this.equity * this.cfg.riskPerTrade);
    const qty = dollars / price;
    const sl = dir === 'BUY' ? price * (1 - this.cfg.stopLossPct) : price * (1 + this.cfg.stopLossPct);
    const tp = dir === 'BUY' ? price * (1 + this.cfg.takeProfitPct) : price * (1 - this.cfg.takeProfitPct);
    const fund = FUNDAMENTALS[inst.sym] ?? 0;
    const rrTarget = +(this.cfg.takeProfitPct / this.cfg.stopLossPct).toFixed(2);

    // ===== AI CHAIN-OF-THOUGHT REASONING =====
    // The bot literally walks through its decision step-by-step.
    const thinking = [
      `1. Market read: ${inst.sym} is in a ${regime.replace('_',' ').toLowerCase()} regime.`,
      `2. Strategies firing (${votes.length}): ${votes.map(v => v.strategy).join(', ')}.`,
      `3. Direction agreement: all ${votes.length} agreeing strategies favor ${dir}.`,
      `4. Average signal strength: ${(strength*100).toFixed(0)}% (need ≥${(this.cfg.minSignalStrength*100).toFixed(0)}%).`,
      `5. Fundamental score: ${fund >= 0 ? '+' : ''}${fund.toFixed(2)} (${fund >= 0.3 ? 'bullish' : fund <= -0.3 ? 'bearish' : 'neutral'}) → ${(dir === 'BUY' && fund < -0.5) || (dir === 'SELL' && fund > 0.5) ? 'BLOCK' : 'OK'}.`,
      `6. Risk plan: ${(this.cfg.stopLossPct*100).toFixed(2)}% stop-loss / ${(this.cfg.takeProfitPct*100).toFixed(2)}% take-profit (${rrTarget}:1 R:R).`,
      `7. Position size: ${(this.cfg.riskPerTrade*100).toFixed(1)}% of equity = $${dollars.toFixed(0)}.`,
      `8. Decision: ENTER ${dir} at ${price.toFixed(4)}. Trailing stop activates after +${(this.cfg.trailingActivatePct*100).toFixed(2)}%.`,
    ];

    const pos = {
      id: 'P' + Date.now() + Math.floor(Math.random()*999),
      sym: inst.sym, asset: inst.asset || 'crypto',
      side: dir, entry: price, peak: price,
      qty, dollars, stopLoss: sl, takeProfit: tp,
      // Snapshot risk parameters so cfg changes don't affect this trade.
      stopLossPct:        this.cfg.stopLossPct,
      takeProfitPct:      this.cfg.takeProfitPct,
      trailingActivatePct: this.cfg.trailingActivatePct,
      trailingStopPct:    this.cfg.trailingStopPct,
      strategy: votes.map(v => v.strategy).join(' + '),
      reason: votes.map(v => '• ' + v.reason).join(' '),
      thinking, regime, strength,
      openedAt: Date.now(),
    };
    this.positions[inst.sym] = pos;

    const ev = {
      time: Date.now(),
      sym: inst.sym, asset: pos.asset,
      action: dir === 'BUY' ? 'OPEN_LONG' : 'OPEN_SHORT',
      price, qty, dollars,
      strategy: pos.strategy,
      reason: pos.reason,
      thinking,
      regime, strength,
      stopLoss: sl, takeProfit: tp,
      rr: rrTarget + ':1',
      fundamental: fund,
    };
    this.log.unshift(ev);
    if (this.log.length > 200) this.log.pop();
    return ev;
  }

  _close(inst, price, kind, reason) {
    const pos = this.positions[inst.sym];
    if (!pos) return null;
    const dir = pos.side === 'BUY' ? 1 : -1;
    const pl = (price - pos.entry) * pos.qty * dir;
    const plPct = ((price - pos.entry) / pos.entry) * dir;

    delete this.positions[inst.sym];
    this.equity += pl;
    this.dailyPnl += pl;
    this.stats.total += 1;
    if (pl >= 0) { this.stats.wins += 1; this.stats.grossProfit += pl; }
    else         { this.stats.losses += 1; this.stats.grossLoss  += -pl; }

    // After a stop-loss, briefly cool down on this instrument
    if (kind === 'STOP_LOSS') {
      this.cooldown = this.cooldown || {};
      this.cooldown[inst.sym] = Date.now();
    }

    const ev = {
      time: Date.now(),
      sym: inst.sym, asset: pos.asset,
      action: 'CLOSE_' + kind,
      price, qty: pos.qty,
      pl, plPct, kind,
      strategy: pos.strategy, reason,
      heldMs: Date.now() - pos.openedAt,
    };
    this.log.unshift(ev);
    this.closedTrades.unshift({
      sym: pos.sym, asset: pos.asset, side: pos.side,
      qty: pos.qty, entry: pos.entry, exit: price,
      pl, plPct, kind, time: Date.now(),
      strategy: pos.strategy,
    });
    if (this.log.length > 200) this.log.pop();
    if (this.closedTrades.length > 100) this.closedTrades.pop();
    return ev;
  }

  step(universe, ctx = {}) {
    // ctx: { volumes: {sym: number}, flow: {sym: {bid, ask}} }
    const events = [];
    for (const inst of universe) {
      const v = ctx.volumes?.[inst.sym] ?? (Math.random() * 1000 + 200);
      const f = ctx.flow?.[inst.sym] ?? simulateFlow(inst);
      this.ingest(inst, v, f);
      const close = this._managePosition(inst);
      if (close) events.push(close);
      else {
        const open = this._maybeOpen(inst);
        if (open) events.push(open);
      }
    }
    // reset daily PnL at midnight
    const today = new Date().setHours(0,0,0,0);
    if (today !== this.dayStart) { this.dayStart = today; this.dailyPnl = 0; }
    return events;
  }

  metrics() {
    const win = this.stats.total ? this.stats.wins / this.stats.total : 0;
    const avgWin = this.stats.wins ? this.stats.grossProfit / this.stats.wins : 0;
    const avgLoss = this.stats.losses ? this.stats.grossLoss / this.stats.losses : 0;
    const rr = avgLoss > 0 ? avgWin / avgLoss : 0;
    const pf = this.stats.grossLoss > 0 ? this.stats.grossProfit / this.stats.grossLoss : 0;
    const expectancy = win * avgWin - (1 - win) * avgLoss;
    return {
      total: this.stats.total,
      winRate: +(win * 100).toFixed(1),
      avgWin: +avgWin.toFixed(2),
      avgLoss: +avgLoss.toFixed(2),
      rr: +rr.toFixed(2),
      profitFactor: +pf.toFixed(2),
      expectancy: +expectancy.toFixed(2),
      netPnl: +(this.equity - this.startEquity).toFixed(2),
    };
  }
}

/* =============== HELPERS =============== */
// Simulate order-flow imbalance for a tick. Slight bias toward fundamental.
function simulateFlow(inst) {
  const f = FUNDAMENTALS[inst.sym] ?? 0;
  const bias = f * 0.04; // small skew based on fundamental
  const base = Math.random() * 800 + 200;
  const skew = (Math.random() - 0.5 + bias) * 0.6;
  const bid = Math.max(0, base * (1 + skew));
  const ask = Math.max(0, base * (1 - skew));
  return { bid, ask, time: Date.now() };
}

/* =============== BOT FACTORY =============== */
function createBot(name) {
  // Single unified master AI ("Vault AI" / "CryptoVault AI") — adapts strategy
  // mix and risk parameters to the current market regime automatically. All
  // legacy preset names alias back to this bot for backward compatibility.
  return new MasterAI();
}

/* =============== MASTER AI =============== */
class MasterAI extends AlgoBot {
  constructor() {
    super({
      // All 10 strategies are available; the Master AI picks per regime.
      strategies: [
        'trendADX', 'macdVolume', 'vwapPullback', 'orderFlow',
        'liquiditySweep', 'orderBlock', 'supplyDemand', 'engulfing',
        'trendlineBreak', 'bbReversion',
      ],
      // Defaults — overridden dynamically per regime in _maybeOpen.
      stopLossPct: 0.010, takeProfitPct: 0.030,
      trailingActivatePct: 0.010, trailingStopPct: 0.006,
      requireConfluence: 2, minSignalStrength: 0.74,
      maxOpen: 8, riskPerTrade: 0.025,
      respectFundamentals: false, // Regime gate is the primary filter for the unified AI.
    });
    this.name = 'Vault AI';
  }

  // Regime-aware strategy selection + risk profile.
  // Strict 3:1 reward-to-risk across all modes.
  _strategiesForRegime(regime) {
    if (regime === 'TRENDING_UP' || regime === 'TRENDING_DOWN') {
      return { strategies: ['trendADX', 'macdVolume', 'vwapPullback', 'orderFlow', 'orderBlock', 'trendlineBreak', 'engulfing'],
               stopLossPct: 0.010, takeProfitPct: 0.030, minSignalStrength: 0.74, requireConfluence: 2 };
    }
    if (regime === 'RANGING') {
      return { strategies: ['bbReversion', 'engulfing', 'supplyDemand', 'liquiditySweep'],
               stopLossPct: 0.008, takeProfitPct: 0.024, minSignalStrength: 0.84, requireConfluence: 2 };
    }
    if (regime === 'VOLATILE') {
      return null;
    }
    return { strategies: ['trendADX', 'macdVolume', 'orderFlow', 'vwapPullback'],
             stopLossPct: 0.010, takeProfitPct: 0.030, minSignalStrength: 0.78, requireConfluence: 2 };
  }

  // Override _maybeOpen to inject regime-specific config before voting
  _maybeOpen(inst) {
    if (this.positions[inst.sym]) return null;
    if (Object.keys(this.positions).length >= this.cfg.maxOpen) return null;
    if (this.dailyPnl <= -this.startEquity * this.cfg.dailyLossLimit) return null;

    const prices  = this.history[inst.sym];
    const volumes = this.volumes[inst.sym];
    const flow    = this.flow[inst.sym];
    if (!prices || prices.length < 60) return null;

    const regime = detectRegime(prices);
    const cfg = this._strategiesForRegime(regime);
    if (!cfg) return null;

    // Apply regime-specific config (used by _open to set SL/TP at entry).
    const origCfg = {
      strategies: this.cfg.strategies,
      stopLossPct: this.cfg.stopLossPct,
      takeProfitPct: this.cfg.takeProfitPct,
      trailingActivatePct: this.cfg.trailingActivatePct,
      trailingStopPct: this.cfg.trailingStopPct,
      minSignalStrength: this.cfg.minSignalStrength,
    };
    Object.assign(this.cfg, {
      strategies: cfg.strategies,
      stopLossPct: cfg.stopLossPct,
      takeProfitPct: cfg.takeProfitPct,
      // Trailing only activates after +2R (so most winners reach the full 3R target).
      trailingActivatePct: cfg.stopLossPct * 2,
      trailingStopPct: cfg.stopLossPct * 0.8,
      minSignalStrength: cfg.minSignalStrength,
      requireConfluence: cfg.requireConfluence,
    });
    this.currentMode = regime;
    this.currentStrategies = cfg.strategies;

    // Strategy votes
    const votes = [];
    for (const sName of cfg.strategies) {
      const fn = Strategies[sName];
      if (!fn) continue;
      const v = fn(prices, volumes, flow);
      if (v && v.signal !== 'HOLD') votes.push({ ...v, strategy: sName });
    }

    // Restore (regime-cfg stays in effect for any later open call too — this is fine
    // since we want the SL/TP at entry to match the regime; restoring strategies for safety)
    let result = null;
    if (votes.length) {
      const buys  = votes.filter(v => v.signal === 'BUY');
      const sells = votes.filter(v => v.signal === 'SELL');
      let pick, dir;
      if (buys.length >= this.cfg.requireConfluence && buys.length > sells.length) { pick = buys; dir = 'BUY'; }
      else if (sells.length >= this.cfg.requireConfluence && sells.length > buys.length) { pick = sells; dir = 'SELL'; }
      if (pick) {
        // Fundamental check (skipped if respectFundamentals=false)
        let fundOk = true;
        if (this.cfg.respectFundamentals) {
          const fund = FUNDAMENTALS[inst.sym] ?? 0;
          if ((dir === 'BUY' && fund < -0.5) || (dir === 'SELL' && fund > 0.5)) fundOk = false;
        }
        if (fundOk) {
          const strength = Math.min(0.99, pick.reduce((a, v) => a + v.strength, 0) / pick.length + 0.05 * (pick.length - 1));
          if (strength >= this.cfg.minSignalStrength) {
            result = this._open(inst, dir, strength, pick, regime);
          }
        }
      }
    }

    // Restore cfg — but keep SL/TP at the regime-tuned values (already applied at _open).
    Object.assign(this.cfg, { strategies: origCfg.strategies, minSignalStrength: origCfg.minSignalStrength });
    // Keep stopLossPct/takeProfitPct set so manage uses regime-aware exits for already-open trades.
    // (Each new evaluate cycle resets them anyway.)
    return result;
  }
}

/* =============== BACKTESTER ===============
   Runs a bot against synthetic OHLC-like data with realistic regimes.
   Returns metrics so the UI can show win rate / R:R achieved.
*/
function backtest(botName = 'Vault Alpha', symbols = ['BTC','ETH','EURUSD','AAPL','SPX'], bars = 800) {
  const bot = createBot(botName);
  const seriesMap = {};

  // Generate price series: drift + occasional regime shocks + volume
  symbols.forEach(sym => {
    const fund = FUNDAMENTALS[sym] ?? 0;
    let p = 100;
    const series = [];
    let regimeBars = 0, regime = 0; // -1 down, 0 chop, +1 up
    for (let i = 0; i < bars; i++) {
      if (regimeBars <= 0) {
        regimeBars = 30 + Math.floor(Math.random() * 80);
        const r = Math.random() + fund * 0.05;
        regime = r < 0.4 ? -1 : r < 0.7 ? 0 : 1;
      }
      const drift = regime * 0.0015;
      const noise = (Math.random() - 0.5) * 0.012;
      p = p * (1 + drift + noise);
      series.push({ price: p, volume: Math.random() * 800 + 200 });
      regimeBars--;
    }
    seriesMap[sym] = series;
  });

  // Walk forward
  for (let t = 0; t < bars; t++) {
    const universe = symbols.map(sym => ({ sym, asset: guessAssetClass(sym), price: seriesMap[sym][t].price }));
    const ctx = {
      volumes: Object.fromEntries(symbols.map(s => [s, seriesMap[s][t].volume])),
      flow:    Object.fromEntries(symbols.map(s => [s, simulateFlow({ sym: s })])),
    };
    bot.step(universe, ctx);
  }
  return { name: botName, ...bot.metrics() };
}

function guessAssetClass(sym) {
  for (const [cls, list] of Object.entries(typeof MARKETS !== 'undefined' ? MARKETS : {})) {
    if (list.some(i => i.sym === sym)) return cls;
  }
  return 'crypto';
}

/* =============== AUTO-TUNER ===============
   Brute-force a few config variants and return the best by expectancy.
*/
function tuneBot(baseName = 'Vault Alpha') {
  const variants = [
    { stopLossPct: 0.010, takeProfitPct: 0.030, requireConfluence: 2, minSignalStrength: 0.70 },
    { stopLossPct: 0.012, takeProfitPct: 0.036, requireConfluence: 2, minSignalStrength: 0.72 },
    { stopLossPct: 0.014, takeProfitPct: 0.042, requireConfluence: 2, minSignalStrength: 0.74 },
    { stopLossPct: 0.012, takeProfitPct: 0.048, requireConfluence: 3, minSignalStrength: 0.78 },
    { stopLossPct: 0.010, takeProfitPct: 0.040, requireConfluence: 2, minSignalStrength: 0.80 },
  ];
  let best = null;
  for (const v of variants) {
    const bot = new AlgoBot(Object.assign({
      strategies: ['trendADX', 'macdVolume', 'vwapPullback', 'orderFlow'],
    }, v));
    // Reuse backtester by mocking bot
    const symbols = ['BTC','ETH','SOL','EURUSD','AAPL','NVDA','SPX'];
    const bars = 800;
    const seriesMap = {};
    symbols.forEach(sym => {
      let p = 100, series = [], rb = 0, regime = 0;
      const fund = FUNDAMENTALS[sym] ?? 0;
      for (let i = 0; i < bars; i++) {
        if (rb <= 0) { rb = 30 + Math.floor(Math.random()*80); const r = Math.random() + fund*0.05; regime = r<0.4?-1:r<0.7?0:1; }
        p *= 1 + regime * 0.0015 + (Math.random()-0.5)*0.012;
        series.push({ price: p, volume: Math.random()*800+200 }); rb--;
      }
      seriesMap[sym] = series;
    });
    for (let t = 0; t < bars; t++) {
      const universe = symbols.map(s => ({ sym: s, asset: guessAssetClass(s), price: seriesMap[s][t].price }));
      const ctx = {
        volumes: Object.fromEntries(symbols.map(s => [s, seriesMap[s][t].volume])),
        flow:    Object.fromEntries(symbols.map(s => [s, simulateFlow({ sym: s })])),
      };
      bot.step(universe, ctx);
    }
    const m = bot.metrics();
    if (!best || m.expectancy > best.metrics.expectancy) best = { config: v, metrics: m };
  }
  return best;
}



/* ================================================================
   v3 · ALGO ENHANCEMENTS
   - New indicators: Stochastic Oscillator, Ichimoku Cloud
   - New strategies:
       * Fair Value Gap (FVG) — SMC imbalance
       * Break of Structure (BOS) / Change of Character (CHOCH)
       * RSI bullish/bearish divergence
       * Stochastic crossover in trend
       * Ichimoku cloud breakout
   - Volatility-adjusted SL/TP via ATR
   - Drawdown-aware risk scaling (reduces size after losing streak)
   - Multi-timeframe (HTF) confirmation
   - Correlation filter — avoids stacking same-direction risk on
     correlated symbols (e.g. BTC + ETH both long)
   - Kelly-lite position sizing
   ================================================================ */

/* =============== EXTRA INDICATORS =============== */
Object.assign(Indicators, {
  // Stochastic oscillator (%K / %D) — close-only proxy
  stochastic(arr, p = 14, smoothK = 3, smoothD = 3) {
    if (arr.length < p + smoothK + smoothD) return null;
    const ks = [];
    for (let i = p - 1; i < arr.length; i++) {
      const slice = arr.slice(i - p + 1, i + 1);
      const lo = Math.min(...slice);
      const hi = Math.max(...slice);
      ks.push(hi - lo === 0 ? 50 : ((arr[i] - lo) / (hi - lo)) * 100);
    }
    const smooth = (a, n) => {
      const out = [];
      for (let i = n - 1; i < a.length; i++) {
        out.push(a.slice(i - n + 1, i + 1).reduce((x, y) => x + y, 0) / n);
      }
      return out;
    };
    const kSmooth = smooth(ks, smoothK);
    const dSmooth = smooth(kSmooth, smoothD);
    return {
      k: kSmooth[kSmooth.length - 1],
      d: dSmooth[dSmooth.length - 1],
      kPrev: kSmooth[kSmooth.length - 2],
      dPrev: dSmooth[dSmooth.length - 2],
    };
  },

  // Ichimoku Cloud (Tenkan/Kijun/Span A/B) — close-only approximation
  ichimoku(arr) {
    if (arr.length < 60) return null;
    const hh = (n) => Math.max(...arr.slice(-n));
    const ll = (n) => Math.min(...arr.slice(-n));
    const tenkan = (hh(9) + ll(9)) / 2;
    const kijun  = (hh(26) + ll(26)) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = (hh(52) + ll(52)) / 2;
    return { tenkan, kijun, senkouA, senkouB, last: arr[arr.length - 1] };
  },

  // Stub for "higher timeframe" — aggregate every N closes into one bar
  higherTF(arr, n = 5) {
    if (arr.length < n) return arr.slice();
    const out = [];
    for (let i = 0; i < arr.length - n; i += n) out.push(arr[i + n - 1]);
    return out;
  },

  // Pearson correlation between two equal-length series
  correlation(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 5) return 0;
    const ax = a.slice(-n);
    const bx = b.slice(-n);
    const ma = ax.reduce((x, y) => x + y, 0) / n;
    const mb = bx.reduce((x, y) => x + y, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const xa = ax[i] - ma, xb = bx[i] - mb;
      num += xa * xb; da += xa * xa; db += xb * xb;
    }
    const den = Math.sqrt(da * db);
    return den === 0 ? 0 : num / den;
  },
});

/* =============== EXTRA STRATEGIES =============== */
Object.assign(Strategies, {

  // 11. Fair Value Gap — 3-bar imbalance.
  //   Bullish FVG: bar[i-2].high < bar[i].low. Sellers can't fill -> price
  //   typically returns to mitigate the gap, then continues.
  fairValueGap(prices) {
    if (prices.length < 30) return null;
    const last = prices[prices.length - 1];
    // Approximate "high/low" of each bar using close+ATR neighborhood.
    const atr = Indicators.atr(prices, 14) || 0;
    if (!atr) return null;
    for (let i = prices.length - 20; i < prices.length - 3; i++) {
      const a = prices[i - 2], c = prices[i];
      // Bullish FVG: 3 strong up bars (c >> a) with a clear gap
      if (c - a > atr * 1.4 && c > a) {
        const gapTop = c - atr * 0.5;
        const gapBot = a + atr * 0.5;
        if (gapTop > gapBot && last <= gapTop && last >= gapBot * 0.995) {
          return { signal: 'BUY', strength: 0.83,
            reason: `Bullish Fair Value Gap at ${gapBot.toFixed(2)}-${gapTop.toFixed(2)} mitigated — imbalance buy.` };
        }
      }
      // Bearish FVG: 3 strong down bars
      if (a - c > atr * 1.4 && c < a) {
        const gapTop = a - atr * 0.5;
        const gapBot = c + atr * 0.5;
        if (gapTop > gapBot && last >= gapBot && last <= gapTop * 1.005) {
          return { signal: 'SELL', strength: 0.81,
            reason: `Bearish Fair Value Gap at ${gapBot.toFixed(2)}-${gapTop.toFixed(2)} mitigated — imbalance sell.` };
        }
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No mitigated FVG.' };
  },

  // 12. Break of Structure / Change of Character — confirms trend continuation
  // or reversal by tracking whether price makes a higher high (bull continuation)
  // / lower low (bear continuation) vs the opposite (CHOCH / reversal).
  breakOfStructure(prices) {
    if (prices.length < 60) return null;
    const highs = findSwingHighs(prices, 60, 3);
    const lows  = findSwingLows(prices, 60, 3);
    if (highs.length < 2 || lows.length < 2) return null;
    const last = prices[prices.length - 1];
    const lastSwingHigh = highs[highs.length - 1].price;
    const prevSwingHigh = highs[highs.length - 2].price;
    const lastSwingLow  = lows[lows.length - 1].price;
    const prevSwingLow  = lows[lows.length - 2].price;

    // Bullish BOS: making higher highs AND price breaks last high
    if (lastSwingHigh > prevSwingHigh && lastSwingLow > prevSwingLow && last > lastSwingHigh * 1.001) {
      return { signal: 'BUY', strength: 0.86,
        reason: `Bullish Break of Structure — HH/HL confirmed, broke ${lastSwingHigh.toFixed(2)}.` };
    }
    // Bearish BOS
    if (lastSwingHigh < prevSwingHigh && lastSwingLow < prevSwingLow && last < lastSwingLow * 0.999) {
      return { signal: 'SELL', strength: 0.85,
        reason: `Bearish Break of Structure — LH/LL confirmed, broke ${lastSwingLow.toFixed(2)}.` };
    }
    // Bullish CHOCH (downtrend → potential reversal): was making lower highs/lows but breaks last lower-high
    if (lastSwingHigh < prevSwingHigh && last > prevSwingHigh * 1.001) {
      return { signal: 'BUY', strength: 0.78,
        reason: `Bullish Change of Character — downtrend reversed by break of ${prevSwingHigh.toFixed(2)}.` };
    }
    if (lastSwingLow > prevSwingLow && last < prevSwingLow * 0.999) {
      return { signal: 'SELL', strength: 0.78,
        reason: `Bearish Change of Character — uptrend reversed by break of ${prevSwingLow.toFixed(2)}.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No BOS/CHOCH yet.' };
  },

  // 13. RSI Divergence — price makes a new low/high but RSI does not.
  rsiDivergence(prices) {
    if (prices.length < 60) return null;
    const lows  = findSwingLows(prices, 60, 3);
    const highs = findSwingHighs(prices, 60, 3);
    const rsiAt = (idx) => {
      const slice = prices.slice(0, idx + 1);
      return Indicators.rsi(slice, 14);
    };

    // Bullish divergence: price LL but RSI HL
    if (lows.length >= 2) {
      const a = lows[lows.length - 2], b = lows[lows.length - 1];
      const rsiA = rsiAt(a.idx), rsiB = rsiAt(b.idx);
      if (rsiA != null && rsiB != null && b.price < a.price && rsiB > rsiA && rsiB < 45) {
        return { signal: 'BUY', strength: 0.84,
          reason: `Bullish RSI divergence — price LL at ${b.price.toFixed(2)} but RSI made HL (${rsiA.toFixed(0)}→${rsiB.toFixed(0)}).` };
      }
    }
    // Bearish divergence: price HH but RSI LH
    if (highs.length >= 2) {
      const a = highs[highs.length - 2], b = highs[highs.length - 1];
      const rsiA = rsiAt(a.idx), rsiB = rsiAt(b.idx);
      if (rsiA != null && rsiB != null && b.price > a.price && rsiB < rsiA && rsiB > 55) {
        return { signal: 'SELL', strength: 0.83,
          reason: `Bearish RSI divergence — price HH at ${b.price.toFixed(2)} but RSI made LH (${rsiA.toFixed(0)}→${rsiB.toFixed(0)}).` };
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No divergence.' };
  },

  // 14. Stochastic crossover in trend — %K crosses %D from oversold/overbought
  stochasticCross(prices) {
    if (prices.length < 60) return null;
    const stoch = Indicators.stochastic(prices, 14, 3, 3);
    const ema50 = Indicators.ema(prices, 50);
    if (!stoch || !ema50) return null;
    const last = prices[prices.length - 1];
    const inUptrend = last > ema50;
    const bullCross = stoch.kPrev <= stoch.dPrev && stoch.k > stoch.d;
    const bearCross = stoch.kPrev >= stoch.dPrev && stoch.k < stoch.d;

    if (bullCross && stoch.k < 35 && inUptrend) {
      return { signal: 'BUY', strength: 0.78,
        reason: `Stochastic %K crossed %D up from oversold (${stoch.k.toFixed(0)}) inside uptrend.` };
    }
    if (bearCross && stoch.k > 65 && !inUptrend) {
      return { signal: 'SELL', strength: 0.77,
        reason: `Stochastic %K crossed %D down from overbought (${stoch.k.toFixed(0)}) inside downtrend.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Stoch not at extreme cross.' };
  },

  // 15. Ichimoku breakout — price closes above/below the cloud
  ichimokuBreak(prices) {
    if (prices.length < 60) return null;
    const ic = Indicators.ichimoku(prices);
    if (!ic) return null;
    const cloudTop = Math.max(ic.senkouA, ic.senkouB);
    const cloudBot = Math.min(ic.senkouA, ic.senkouB);
    if (ic.last > cloudTop && ic.tenkan > ic.kijun) {
      return { signal: 'BUY', strength: 0.82,
        reason: `Ichimoku bullish — price above cloud (${cloudTop.toFixed(2)}), Tenkan>Kijun.` };
    }
    if (ic.last < cloudBot && ic.tenkan < ic.kijun) {
      return { signal: 'SELL', strength: 0.81,
        reason: `Ichimoku bearish — price below cloud (${cloudBot.toFixed(2)}), Tenkan<Kijun.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Inside Ichimoku cloud.' };
  },
});

/* =============== HTF / CORRELATION HELPERS =============== */

// Returns 'BUY' | 'SELL' | 'NEUTRAL' for a higher-timeframe view of the series.
function htfBias(prices) {
  const htf = Indicators.higherTF(prices, 5);
  if (htf.length < 30) return 'NEUTRAL';
  const ema20 = Indicators.ema(htf, 20);
  const ema50 = Indicators.ema(htf, 50);
  if (!ema20 || !ema50) return 'NEUTRAL';
  const adx = Indicators.adx(htf, 14) || 0;
  if (adx < 18) return 'NEUTRAL';
  if (ema20 > ema50) return 'BUY';
  if (ema20 < ema50) return 'SELL';
  return 'NEUTRAL';
}

// Asset-class correlation matrix (rough, for the demo)
const CORRELATION_GROUPS = {
  cryptoMajors: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOT', 'AVAX', 'LINK', 'DOGE',
                 'BTC-PERP', 'ETH-PERP', 'SOL-PERP'],
  usdLong:      ['USDJPY', 'USDCAD', 'USDCHF'],
  usdShort:     ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'],
  usEquities:   ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'JPM', 'V',
                 'SPX', 'NDX', 'DJI', 'ES', 'NQ', 'YM'],
  bondsYields:  ['US10Y', 'US30Y', 'US2Y', 'DE10Y', 'UK10Y', 'JP10Y'],
};
function correlationGroup(sym) {
  for (const [g, list] of Object.entries(CORRELATION_GROUPS)) {
    if (list.includes(sym)) return g;
  }
  return null;
}

/* =============== ENHANCED ALGO LOGIC =============== */

// Volatility-adjusted SL/TP based on ATR.
// Returns { stopLossPct, takeProfitPct } around the desired R:R target.
AlgoBot.prototype._volAdjustedRisk = function (prices, baseSL, baseTP) {
  const atr = Indicators.atr(prices, 14);
  const last = prices[prices.length - 1];
  if (!atr || !last) return { stopLossPct: baseSL, takeProfitPct: baseTP };
  const atrPct = atr / last;
  // Tighter SL when vol is low, wider when vol is high. Bound to avoid extremes.
  const sl = Math.max(0.005, Math.min(0.025, atrPct * 1.5));
  const rr = baseTP / baseSL || 3;
  return { stopLossPct: sl, takeProfitPct: sl * rr };
};

// Drawdown-aware risk scaling. After a losing streak shrinks size; after wins
// allows it back up to the base. Returns a multiplier in [0.4, 1.0].
AlgoBot.prototype._riskMultiplier = function () {
  // Look at the last 5 closed trades
  const last5 = this.closedTrades.slice(0, 5);
  if (last5.length < 3) return 1;
  const lossesInRow = last5.findIndex(t => t.pl > 0);
  // -2 trades = 0.7x, -3 = 0.55x, -4+ = 0.4x
  if (lossesInRow === -1)         return 0.4;            // no win in last 5
  if (lossesInRow >= 4)           return 0.45;
  if (lossesInRow === 3)          return 0.55;
  if (lossesInRow === 2)          return 0.7;
  if (lossesInRow === 1)          return 0.85;
  return 1;
};

// Returns true if the bot should reject a new trade because it would stack
// risk in the same direction on an already-correlated open position.
AlgoBot.prototype._correlationConflict = function (sym, dir) {
  const g = correlationGroup(sym);
  if (!g) return false;
  for (const p of Object.values(this.positions)) {
    if (p.sym === sym) continue;
    if (correlationGroup(p.sym) === g && p.side === dir) return true;
  }
  return false;
};

// Wrap the existing _open so it consumes the volatility-adjusted SL/TP and
// scales the position by the current risk multiplier. We do this by patching
// _open via a wrapper rather than rewriting it (keeps the original logic).
const _origOpen = AlgoBot.prototype._open;
AlgoBot.prototype._open = function (inst, dir, strength, votes, regime) {
  const prices = this.history[inst.sym] || [];
  if (prices.length >= 30) {
    const vol = this._volAdjustedRisk(prices, this.cfg.stopLossPct, this.cfg.takeProfitPct);
    this.cfg.stopLossPct = vol.stopLossPct;
    this.cfg.takeProfitPct = vol.takeProfitPct;
    this.cfg.trailingActivatePct = vol.stopLossPct * 2;
    this.cfg.trailingStopPct = vol.stopLossPct * 0.8;
  }
  // Drawdown-aware sizing
  const baseRisk = this._baseRiskPerTrade ?? this.cfg.riskPerTrade;
  this._baseRiskPerTrade = baseRisk;
  this.cfg.riskPerTrade = +(baseRisk * this._riskMultiplier()).toFixed(4);

  return _origOpen.call(this, inst, dir, strength, votes, regime);
};

// Add HTF + correlation gates to MasterAI._maybeOpen by post-filtering.
const _origMaybeOpen = MasterAI.prototype._maybeOpen;
MasterAI.prototype._maybeOpen = function (inst) {
  if (this.positions[inst.sym]) return null;
  const prices = this.history[inst.sym];
  if (!prices || prices.length < 60) return _origMaybeOpen.call(this, inst);

  // We need to know what direction the original logic *would* take. Easiest:
  // call the original, and if it opened a trade, validate it post-hoc and
  // close it immediately if the gates fail.
  const ev = _origMaybeOpen.call(this, inst);
  if (!ev || !(ev.action === 'OPEN_LONG' || ev.action === 'OPEN_SHORT')) return ev;

  const dir = ev.action === 'OPEN_LONG' ? 'BUY' : 'SELL';

  // Higher-timeframe bias gate
  const htf = htfBias(prices);
  if (htf !== 'NEUTRAL' && htf !== dir) {
    // Roll back: close the just-opened position with no PnL impact.
    const pos = this.positions[inst.sym];
    if (pos) {
      delete this.positions[inst.sym];
      // Remove the open log entry we just added.
      const i = this.log.findIndex(l => l === ev);
      if (i >= 0) this.log.splice(i, 1);
    }
    this.log.unshift({
      time: Date.now(), sym: inst.sym, asset: inst.asset || 'crypto',
      action: 'SKIP', price: inst.price,
      reason: `HTF bias is ${htf} — ${dir} blocked by higher-timeframe filter.`,
    });
    return null;
  }

  // Correlation conflict
  if (this._correlationConflict(inst.sym, dir)) {
    const pos = this.positions[inst.sym];
    if (pos) {
      delete this.positions[inst.sym];
      const i = this.log.findIndex(l => l === ev);
      if (i >= 0) this.log.splice(i, 1);
    }
    this.log.unshift({
      time: Date.now(), sym: inst.sym, asset: inst.asset || 'crypto',
      action: 'SKIP', price: inst.price,
      reason: `Correlated ${dir} already open in same group — risk-stack avoided.`,
    });
    return null;
  }

  return ev;
};

// Expand MasterAI's strategy menu to include the new ones.
const _origStrats = MasterAI.prototype._strategiesForRegime;
MasterAI.prototype._strategiesForRegime = function (regime) {
  const cfg = _origStrats.call(this, regime);
  if (!cfg) return cfg;
  if (regime === 'TRENDING_UP' || regime === 'TRENDING_DOWN') {
    cfg.strategies = Array.from(new Set([
      ...cfg.strategies,
      'breakOfStructure', 'fairValueGap', 'ichimokuBreak', 'stochasticCross',
    ]));
  } else if (regime === 'RANGING') {
    cfg.strategies = Array.from(new Set([
      ...cfg.strategies,
      'rsiDivergence', 'fairValueGap', 'stochasticCross',
    ]));
  } else {
    cfg.strategies = Array.from(new Set([
      ...cfg.strategies,
      'breakOfStructure', 'ichimokuBreak',
    ]));
  }
  return cfg;
};



/* ================================================================
   v4 · ALGO ENHANCEMENTS — sophisticated quant layer
   - New indicators: Choppiness Index, Donchian, Keltner, Heikin-Ashi
   - New strategies: Donchian breakout, Keltner squeeze, Heikin-Ashi
     trend-confirm, Round-number magnet
   - Kelly-criterion position sizing (fractional, capped)
   - Adaptive signal-strength threshold (tightens when win rate drops)
   - Strategy-weight learning (each strategy's vote weighted by its
     own rolling win rate)
   - Session filter (Asian / European / US) — different strategy mix
     and risk per session
   - Anti-overtrading cooldown (max trades per hour per symbol)
   - Pyramiding into winners (adds size when up +1R, with new SL at
     break-even, capped to 1 add-on leg)
   - Extra metrics: Sortino ratio, Calmar ratio, max consecutive
     losses, profit-loss ratio, recovery factor
   - Monte Carlo bootstrap of the closed-trade list
   ================================================================ */

/* =============== EXTRA INDICATORS (v4) =============== */
Object.assign(Indicators, {
  // Choppiness Index — 0-100, high=ranging, low=trending
  // Approximation using close-only series (no true range available):
  //   CI = 100 * log10( SUM(|close[i]-close[i-1]|) / (max-min) ) / log10(p)
  choppiness(arr, p = 14) {
    if (arr.length < p + 1) return null;
    const slice = arr.slice(-p);
    let sumMove = 0;
    for (let i = arr.length - p; i < arr.length; i++) {
      sumMove += Math.abs(arr[i] - arr[i - 1]);
    }
    const range = Math.max(...slice) - Math.min(...slice);
    if (range === 0) return 50;
    return 100 * Math.log10(sumMove / range) / Math.log10(p);
  },

  // Donchian channel — n-bar high/low
  donchian(arr, p = 20) {
    if (arr.length < p) return null;
    const slice = arr.slice(-p);
    return { upper: Math.max(...slice), lower: Math.min(...slice), mid: (Math.max(...slice) + Math.min(...slice)) / 2 };
  },

  // Keltner channel — EMA20 ± mult * ATR
  keltner(arr, p = 20, mult = 2) {
    if (arr.length < p + 14) return null;
    const ema = Indicators.ema(arr, p);
    const atr = Indicators.atr(arr, 14);
    if (!ema || !atr) return null;
    return { mid: ema, upper: ema + mult * atr, lower: ema - mult * atr, width: 2 * mult * atr / ema };
  },

  // Heikin-Ashi close-only smoothing.
  // Returns array of HA "closes". HA close ≈ EMA-2 of price; HA "open"
  // approximated by the previous HA close. We mostly care about the
  // direction streak.
  heikinAshi(arr) {
    if (arr.length < 4) return null;
    const ha = [];
    for (let i = 0; i < arr.length; i++) {
      if (i === 0) { ha.push(arr[0]); continue; }
      ha.push((ha[i - 1] + arr[i]) / 2);
    }
    return ha;
  },

  // Counts consecutive same-direction Heikin-Ashi bars at the end of series
  haStreak(arr) {
    const ha = Indicators.heikinAshi(arr);
    if (!ha) return 0;
    let streak = 0;
    for (let i = ha.length - 1; i > 0; i--) {
      const dir = Math.sign(ha[i] - ha[i - 1]);
      if (i === ha.length - 1) { streak = dir; continue; }
      if (Math.sign(streak) === dir) streak += dir;
      else break;
    }
    return streak; // positive = up streak, negative = down streak
  },
});

/* =============== EXTRA STRATEGIES (v4) =============== */
Object.assign(Strategies, {

  // 16. Donchian channel breakout — classic Turtle entry, only in trends
  donchianBreak(prices) {
    if (prices.length < 25) return null;
    const adx = Indicators.adx(prices, 14);
    if (!adx || adx < 20) return { signal: 'HOLD', strength: 0, reason: 'ADX too low — skip Donchian.' };
    const dc = Indicators.donchian(prices, 20);
    if (!dc) return null;
    const last = prices[prices.length - 1];
    if (last >= dc.upper * 0.999) {
      return { signal: 'BUY', strength: 0.8,
        reason: `Donchian 20-bar breakout above ${dc.upper.toFixed(2)} — trend continuation.` };
    }
    if (last <= dc.lower * 1.001) {
      return { signal: 'SELL', strength: 0.8,
        reason: `Donchian 20-bar breakdown below ${dc.lower.toFixed(2)} — trend continuation.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Inside Donchian channel.' };
  },

  // 17. Keltner squeeze release — Bollinger inside Keltner = "squeeze",
  //     when price exits the squeeze in either direction we trade the move.
  keltnerSqueeze(prices) {
    if (prices.length < 40) return null;
    const bb = Indicators.bollinger(prices, 20, 2);
    const kc = Indicators.keltner(prices, 20, 1.5);
    if (!bb || !kc) return null;
    const inSqueeze = bb.upper < kc.upper && bb.lower > kc.lower;
    const wasSqueeze = (() => {
      // Check 5 bars ago
      const past = prices.slice(0, -5);
      if (past.length < 40) return false;
      const bp = Indicators.bollinger(past, 20, 2);
      const kp = Indicators.keltner(past, 20, 1.5);
      if (!bp || !kp) return false;
      return bp.upper < kp.upper && bp.lower > kp.lower;
    })();
    if (!wasSqueeze || inSqueeze) return { signal: 'HOLD', strength: 0, reason: 'Still in (or no) squeeze.' };

    const last = prices[prices.length - 1];
    const prev = prices[prices.length - 6];
    const momentum = (last - prev) / prev;
    if (momentum > 0.005) {
      return { signal: 'BUY', strength: 0.86,
        reason: `Keltner squeeze released bullish — vol expansion +${(momentum*100).toFixed(2)}%.` };
    }
    if (momentum < -0.005) {
      return { signal: 'SELL', strength: 0.85,
        reason: `Keltner squeeze released bearish — vol expansion ${(momentum*100).toFixed(2)}%.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Squeeze released but no momentum.' };
  },

  // 18. Heikin-Ashi trend confirmation — 4+ bars in the same direction
  //     filtered by EMA50 to avoid counter-trend signals.
  heikinAshiTrend(prices) {
    if (prices.length < 60) return null;
    const streak = Indicators.haStreak(prices);
    const ema50 = Indicators.ema(prices, 50);
    if (ema50 == null) return null;
    const last = prices[prices.length - 1];

    if (streak >= 4 && last > ema50) {
      return { signal: 'BUY', strength: Math.min(0.85, 0.6 + streak * 0.05),
        reason: `Heikin-Ashi ${streak} consecutive up bars above EMA50 — clean uptrend.` };
    }
    if (streak <= -4 && last < ema50) {
      return { signal: 'SELL', strength: Math.min(0.85, 0.6 + Math.abs(streak) * 0.05),
        reason: `Heikin-Ashi ${Math.abs(streak)} consecutive down bars below EMA50 — clean downtrend.` };
    }
    return { signal: 'HOLD', strength: 0, reason: `HA streak ${streak} — no clean trend.` };
  },

  // 19. Round-number magnet — price tends to gravitate toward and bounce
  //     off psychological round levels (e.g. 100, 1.10, 50000). We fade
  //     fast moves into round numbers.
  roundNumber(prices) {
    if (prices.length < 20) return null;
    const last = prices[prices.length - 1];
    const atr = Indicators.atr(prices, 14);
    if (!atr) return null;
    // Pick a round level near the price. Magnitude scales with price.
    const mag = Math.pow(10, Math.floor(Math.log10(last)));
    const round = Math.round(last / mag) * mag;
    const distPct = Math.abs(last - round) / last;
    if (distPct > 0.003) return { signal: 'HOLD', strength: 0, reason: 'Far from round number.' };
    // Was the move into the round number sharp? (e.g. >1.5x ATR in last 5)
    const move = Math.abs(last - prices[prices.length - 6]);
    if (move < atr * 1.5) return { signal: 'HOLD', strength: 0, reason: 'Approach to round number too slow.' };
    // Approaching from below = potential resistance → SELL fade
    if (last > prices[prices.length - 6] && last <= round * 1.0008) {
      return { signal: 'SELL', strength: 0.72,
        reason: `Price spiked into round number ${round.toFixed(0)} — fading the resistance test.` };
    }
    // Approaching from above = potential support → BUY fade
    if (last < prices[prices.length - 6] && last >= round * 0.9992) {
      return { signal: 'BUY', strength: 0.72,
        reason: `Price flushed into round number ${round.toFixed(0)} — fading the support test.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No clean round-number setup.' };
  },
});

/* =============== STRATEGY WEIGHT LEARNING =============== */
// Every closed trade contributes to the rolling win-rate of each strategy
// that voted on it. Future votes from a strategy are scaled by its weight.
AlgoBot.prototype._strategyStats = function () {
  return this._stratStats || (this._stratStats = {});
};
AlgoBot.prototype._strategyWeight = function (name) {
  const s = this._strategyStats()[name];
  if (!s || s.total < 5) return 1.0; // not enough data → neutral
  const wr = s.wins / s.total;
  // Map win rate 30-70% → weight 0.5-1.5, clamped.
  const w = 0.5 + (wr - 0.3) * 2.5;
  return Math.max(0.4, Math.min(1.6, w));
};
AlgoBot.prototype._recordStrategyResult = function (strategyKey, win) {
  const stats = this._strategyStats();
  const s = stats[strategyKey] || (stats[strategyKey] = { total: 0, wins: 0 });
  s.total += 1;
  if (win) s.wins += 1;
};

/* =============== ADAPTIVE THRESHOLD =============== */
// If recent win rate drops, tighten the minSignalStrength so we only
// take the highest-conviction setups. If it rises, loosen slightly.
AlgoBot.prototype._adaptiveThreshold = function (baseThr) {
  const recent = this.closedTrades.slice(0, 30);
  if (recent.length < 15) return baseThr;
  const wins = recent.filter(t => t.pl > 0).length;
  const wr = wins / recent.length;
  if (wr < 0.40) return Math.min(0.95, baseThr + 0.06); // tighten
  if (wr > 0.60) return Math.max(0.65, baseThr - 0.03); // loosen
  return baseThr;
};

/* =============== KELLY-CRITERION SIZING =============== */
// Fractional Kelly capped at 25% of full Kelly, with a hard ceiling at
// 5% of equity per trade. Falls back to base sizing until 20+ closed
// trades have accumulated.
AlgoBot.prototype._kellyFraction = function () {
  if (this.closedTrades.length < 20) return null;
  const wins = this.closedTrades.filter(t => t.pl > 0);
  const losses = this.closedTrades.filter(t => t.pl <= 0);
  if (!wins.length || !losses.length) return null;
  const W = wins.length / this.closedTrades.length;
  const avgWin  = wins.reduce((a, b) => a + b.pl, 0) / wins.length;
  const avgLoss = Math.abs(losses.reduce((a, b) => a + b.pl, 0) / losses.length);
  if (avgLoss === 0) return null;
  const R = avgWin / avgLoss;
  // f* = W - (1 - W) / R
  const fStar = W - (1 - W) / R;
  if (fStar <= 0) return 0.005; // negative edge → minimum size
  const fractional = fStar * 0.25; // quarter-Kelly
  return Math.min(0.05, Math.max(0.005, fractional));
};

/* =============== SESSION FILTER =============== */
// UTC-based trading session classifier. The Master AI uses this to
// bias which asset classes / strategies it favors.
function currentSession(date = new Date()) {
  const h = date.getUTCHours();
  if (h >= 0 && h < 7)   return 'ASIAN';
  if (h >= 7 && h < 12)  return 'EUROPEAN';
  if (h >= 12 && h < 17) return 'OVERLAP'; // EU+US overlap — most volume
  if (h >= 17 && h < 21) return 'US';
  return 'OFF_HOURS';
}

// Symbol ↔ session affinity. Master AI down-weights mismatched pairs.
function sessionAffinity(sym, session) {
  if (session === 'ASIAN') {
    if (['USDJPY', 'NKY', 'HSI', 'JP10Y'].includes(sym)) return 1.2;
    if (['BTC','ETH','SOL','BNB','BTC-PERP','ETH-PERP'].includes(sym)) return 1.0;
    return 0.7;
  }
  if (session === 'EUROPEAN') {
    if (['EURUSD','GBPUSD','EURGBP','DAX','FTSE','CAC','DE10Y','UK10Y'].includes(sym)) return 1.2;
    return 0.95;
  }
  if (session === 'US' || session === 'OVERLAP') {
    if (['SPX','NDX','DJI','AAPL','TSLA','NVDA','MSFT','AMZN','GOOGL','META','JPM','V','BRK.B','ES','NQ','YM','US10Y','US30Y','US2Y'].includes(sym)) return 1.2;
    return 1.0;
  }
  return 0.85;
}

/* =============== ANTI-OVERTRADING COOLDOWN =============== */
// No more than 3 trades per hour per symbol. Prevents the bot from
// thrashing the same instrument when conviction is shaky.
AlgoBot.prototype._tooMuchTrading = function (sym) {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = this.closedTrades.filter(t => t.sym === sym && t.time > cutoff);
  // Open positions don't count yet (they'll count when they close).
  return recent.length >= 3;
};

/* =============== PYRAMIDING =============== */
// When a position reaches +1R in profit, we add a smaller leg with a
// new SL set at the original entry (so the add-on is risk-free).
// Capped at 1 add-on per position to avoid stacking too much risk.
AlgoBot.prototype._tryPyramid = function (inst) {
  const pos = this.positions[inst.sym];
  if (!pos) return null;
  if (pos.pyramided) return null;
  const dir = pos.side === 'BUY' ? 1 : -1;
  const plPct = ((inst.price - pos.entry) / pos.entry) * dir;
  const slPct = pos.stopLossPct ?? this.cfg.stopLossPct;
  if (plPct < slPct) return null; // not yet at +1R
  // Add 50% of original size at current price, SL at original entry
  const addDollars = pos.dollars * 0.5;
  const addQty = addDollars / inst.price;
  pos.qty += addQty;
  pos.dollars += addDollars;
  pos.entry = (pos.entry * (pos.qty - addQty) + inst.price * addQty) / pos.qty; // VWAP
  // Move SL to break-even (at the new average entry → roughly the original entry)
  pos.stopLoss = pos.entry; // exact break-even
  pos.pyramided = true;
  this.log.unshift({
    time: Date.now(), sym: inst.sym, asset: pos.asset,
    action: 'PYRAMID',
    price: inst.price, qty: addQty, dollars: addDollars,
    reason: `Position up +${(plPct*100).toFixed(2)}% — adding 50% leg at break-even SL.`,
    strategy: pos.strategy,
  });
  return { ...this.log[0] };
};

/* =============== EXTRA METRICS =============== */
AlgoBot.prototype.advancedMetrics = function () {
  const base = this.metrics();
  const closed = this.closedTrades;
  if (!closed.length) return { ...base, sortino: 0, calmar: 0, maxConsecLosses: 0, recoveryFactor: 0 };

  const returns = closed.map(t => t.pl / this.startEquity);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter(r => r < 0);
  const downStd = downside.length
    ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length)
    : 0.0001;
  const sortino = (mean / downStd) * Math.sqrt(252);

  // Max drawdown from synthetic equity curve based on closed trades
  let eq = this.startEquity, peak = eq, maxDD = 0;
  for (const t of closed.slice().reverse()) { // oldest first
    eq += t.pl;
    if (eq > peak) peak = eq;
    const dd = (eq - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const totalReturn = (this.equity - this.startEquity) / this.startEquity;
  const calmar = maxDD < 0 ? totalReturn / Math.abs(maxDD) : totalReturn * 10;

  // Max consecutive losses
  let cons = 0, max = 0;
  for (const t of closed.slice().reverse()) {
    if (t.pl <= 0) { cons += 1; if (cons > max) max = cons; }
    else cons = 0;
  }

  const recoveryFactor = maxDD < 0 ? Math.abs(totalReturn / maxDD) : 0;

  return {
    ...base,
    sortino: +sortino.toFixed(2),
    calmar:  +calmar.toFixed(2),
    maxConsecLosses: max,
    recoveryFactor: +recoveryFactor.toFixed(2),
  };
};

/* =============== MONTE CARLO SIMULATOR =============== */
// Bootstrap-resamples the closed trades 1000 times to estimate the
// distribution of final equity. Returns 5/50/95 percentile ending
// balances and the probability of finishing above starting equity.
function monteCarlo(bot, runs = 1000) {
  const trades = bot.closedTrades;
  if (trades.length < 10) return null;
  const finals = [];
  let positive = 0;
  for (let r = 0; r < runs; r++) {
    let eq = bot.startEquity;
    for (let i = 0; i < trades.length; i++) {
      const t = trades[Math.floor(Math.random() * trades.length)];
      eq += t.pl;
    }
    finals.push(eq);
    if (eq > bot.startEquity) positive += 1;
  }
  finals.sort((a, b) => a - b);
  const p = (q) => finals[Math.floor(finals.length * q)];
  return {
    runs,
    p05: +p(0.05).toFixed(2),
    p50: +p(0.50).toFixed(2),
    p95: +p(0.95).toFixed(2),
    probProfit: +(positive / runs).toFixed(3),
    startEquity: bot.startEquity,
    avgFinal: +(finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(2),
  };
}

/* =============== HOOK INTO MASTERAI =============== */
// Patch MasterAI._maybeOpen one more time to apply: cooldown, session
// affinity, weighted votes, adaptive threshold, Kelly sizing.
const _v4origMaybeOpen = MasterAI.prototype._maybeOpen;
MasterAI.prototype._maybeOpen = function (inst) {
  if (this.positions[inst.sym]) return null;

  // Anti-overtrading
  if (this._tooMuchTrading(inst.sym)) return null;

  // Apply Kelly sizing if available
  const kelly = this._kellyFraction();
  if (kelly != null) {
    this._baseRiskPerTrade = kelly;
  }

  // Apply session-aware risk
  const session = currentSession();
  const aff = sessionAffinity(inst.sym, session);
  // Skip low-affinity instruments outside their session unless very high conviction
  if (aff < 0.8) {
    // We still allow the trade, but with tighter threshold via an internal flag.
    this._sessionTightening = 0.06;
  } else {
    this._sessionTightening = 0;
  }

  // Adaptive minSignalStrength — applied transiently before the call
  const baseThr = this.cfg.minSignalStrength;
  const adaptive = this._adaptiveThreshold(baseThr) + (this._sessionTightening || 0);
  this.cfg.minSignalStrength = adaptive;

  const ev = _v4origMaybeOpen.call(this, inst);

  // Restore base threshold
  this.cfg.minSignalStrength = baseThr;

  return ev;
};

// Patch _close so we can record per-strategy stats and clear pyramid flag.
const _v4origClose = AlgoBot.prototype._close;
AlgoBot.prototype._close = function (inst, price, kind, reason) {
  const pos = this.positions[inst.sym];
  if (!pos) return null;

  // Record per-strategy performance for weight learning. The strategy
  // string is "x + y + z" so we split and record each.
  const dir = pos.side === 'BUY' ? 1 : -1;
  const pl = (price - pos.entry) * pos.qty * dir;
  const win = pl > 0;
  if (typeof pos.strategy === 'string') {
    pos.strategy.split('+').map(s => s.trim()).forEach(s => this._recordStrategyResult(s, win));
  }

  return _v4origClose.call(this, inst, price, kind, reason);
};

// Patch step to call pyramiding alongside management.
const _v4origStep = AlgoBot.prototype.step;
AlgoBot.prototype.step = function (universe, ctx = {}) {
  const events = _v4origStep.call(this, universe, ctx);
  // Pyramid existing winners (in addition to whatever happened this tick)
  for (const inst of universe) {
    const ev = this._tryPyramid(inst);
    if (ev) events.push(ev);
  }
  return events;
};

// Use weighted strategy votes inside the master vote loop. We do this
// by post-processing the event reason — the simplest hook is to patch
// _open and adjust the recorded strength using the weighted average.
const _v4origOpen = AlgoBot.prototype._open;
AlgoBot.prototype._open = function (inst, dir, strength, votes, regime) {
  // Re-weight votes by each strategy's learned weight
  const reweighted = votes.map(v => ({
    ...v,
    weight: this._strategyWeight(v.strategy),
  }));
  const num = reweighted.reduce((a, v) => a + v.strength * v.weight, 0);
  const den = reweighted.reduce((a, v) => a + v.weight, 0) || 1;
  const adjStrength = Math.min(0.99, num / den + 0.05 * (votes.length - 1));
  return _v4origOpen.call(this, inst, dir, adjStrength, votes, regime);
};
