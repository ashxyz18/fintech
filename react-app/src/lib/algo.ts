/* =============================================================
   CryptoVault — Algo engine (TypeScript port of js/algo.js)

   Architecture:
   - Indicators: SMA, EMA, RSI, MACD, Bollinger, ATR, VWAP, OBV, ADX
   - Strategies: 10 named strategies returning { signal, strength, reason }
   - AlgoBot: ingests prices, manages positions, votes via confluence
   - MasterAI: regime-aware bot that swaps strategy mix per regime
   - backtest / tuneBot: walk-forward simulators
   ============================================================= */

import type {
  AssetClass,
  BotConfig,
  BotEvent,
  BotEventClose,
  BotEventOpen,
  BotMetrics,
  CloseKind,
  Instrument,
  OrderFlowTick,
  Position,
  Regime,
  Side,
  Signal,
  StepContext,
  Vote,
} from '../types';
import { FUNDAMENTALS, MARKETS } from '../data/markets';

/* =============== INDICATORS =============== */
export const Indicators = {
  sma(arr: number[], p: number): number | null {
    if (arr.length < p) return null;
    let s = 0;
    for (let i = arr.length - p; i < arr.length; i++) s += arr[i];
    return s / p;
  },
  ema(arr: number[], p: number): number | null {
    if (arr.length < p) return null;
    const k = 2 / (p + 1);
    const seed = Indicators.sma(arr.slice(0, p), p);
    if (seed === null) return null;
    let e = seed;
    for (let i = p; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
    return e;
  },
  rsi(arr: number[], p = 14): number | null {
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
  macd(arr: number[], fast = 12, slow = 26, sig = 9):
    | { macd: number; signal: number | null; hist: number }
    | null {
    if (arr.length < slow + sig) return null;
    const macdLine: number[] = [];
    let ef = Indicators.sma(arr.slice(0, fast), fast);
    let es = Indicators.sma(arr.slice(0, slow), slow);
    if (ef === null || es === null) return null;
    const kF = 2 / (fast + 1), kS = 2 / (slow + 1);
    for (let i = slow; i < arr.length; i++) {
      ef = arr[i] * kF + ef * (1 - kF);
      es = arr[i] * kS + es * (1 - kS);
      macdLine.push(ef - es);
    }
    const signal = Indicators.sma(macdLine.slice(-sig), sig);
    const macd = macdLine[macdLine.length - 1];
    return { macd, signal, hist: macd - (signal ?? 0) };
  },
  bollinger(arr: number[], p = 20, mult = 2):
    | { mid: number; upper: number; lower: number; width: number }
    | null {
    if (arr.length < p) return null;
    const slice = arr.slice(-p);
    const mid = slice.reduce((a, b) => a + b, 0) / p;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / p);
    return { mid, upper: mid + mult * sd, lower: mid - mult * sd, width: (2 * mult * sd) / mid };
  },
  atr(arr: number[], p = 14): number | null {
    if (arr.length < p + 1) return null;
    const trs: number[] = [];
    for (let i = 1; i < arr.length; i++) trs.push(Math.abs(arr[i] - arr[i - 1]));
    const last = trs.slice(-p);
    return last.reduce((a, b) => a + b, 0) / p;
  },
  vwap(prices: number[], volumes: number[]): number | null {
    if (!prices.length) return null;
    let pv = 0, vv = 0;
    for (let i = 0; i < prices.length; i++) { pv += prices[i] * volumes[i]; vv += volumes[i]; }
    return vv === 0 ? null : pv / vv;
  },
  obv(prices: number[], volumes: number[]): number | null {
    if (prices.length < 2) return null;
    let obv = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) obv += volumes[i];
      else if (prices[i] < prices[i - 1]) obv -= volumes[i];
    }
    return obv;
  },
  adx(arr: number[], p = 14): number | null {
    if (arr.length < p * 2) return null;
    const plusDM: number[] = [], minusDM: number[] = [], tr: number[] = [];
    for (let i = 1; i < arr.length; i++) {
      const move = arr[i] - arr[i - 1];
      plusDM.push(move > 0 ? move : 0);
      minusDM.push(move < 0 ? -move : 0);
      tr.push(Math.abs(move));
    }
    const smooth = (a: number[], pp: number) => {
      const out = [a.slice(0, pp).reduce((x, y) => x + y, 0)];
      for (let i = pp; i < a.length; i++) {
        out.push(out[out.length - 1] - out[out.length - 1] / pp + a[i]);
      }
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

/* =============== REGIME =============== */
export function detectRegime(prices: number[]): Regime {
  if (prices.length < 60) return 'UNKNOWN';
  const adx = Indicators.adx(prices, 14) || 0;
  const bb = Indicators.bollinger(prices, 20, 2);
  const ema20 = Indicators.ema(prices, 20);
  const ema50 = Indicators.ema(prices, 50);
  if (!bb || ema20 === null || ema50 === null) return 'UNKNOWN';
  if (bb.width > 0.06) return 'VOLATILE';
  if (adx > 25 && ema20 > ema50) return 'TRENDING_UP';
  if (adx > 25 && ema20 < ema50) return 'TRENDING_DOWN';
  return 'RANGING';
}

/* =============== HELPERS =============== */
function findSwingHighs(prices: number[], lookback = 30, leftRight = 3) {
  const out: { idx: number; price: number }[] = [];
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
function findSwingLows(prices: number[], lookback = 30, leftRight = 3) {
  const out: { idx: number; price: number }[] = [];
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

/* Simulate order-flow imbalance for a tick (with a slight fundamental bias). */
export function simulateFlow(inst: Pick<Instrument, 'sym'>): OrderFlowTick {
  const f = FUNDAMENTALS[inst.sym] ?? 0;
  const bias = f * 0.04;
  const base = Math.random() * 800 + 200;
  const skew = (Math.random() - 0.5 + bias) * 0.6;
  const bid = Math.max(0, base * (1 + skew));
  const ask = Math.max(0, base * (1 - skew));
  return { bid, ask, time: Date.now() };
}

/* =============== STRATEGIES =============== */

type StrategyFn = (
  prices: number[],
  volumes: number[],
  flow: OrderFlowTick[],
) => Signal | null;

export const Strategies: Record<string, StrategyFn> = {

  trendADX(prices) {
    if (prices.length < 60) return null;
    const ema20 = Indicators.ema(prices, 20);
    const ema50 = Indicators.ema(prices, 50);
    const adx   = Indicators.adx(prices, 14);
    const rsi   = Indicators.rsi(prices, 14);
    if (ema20 === null || ema50 === null || rsi === null) return null;
    if (!adx || adx < 22) return { signal: 'HOLD', strength: 0, reason: `ADX ${adx ? adx.toFixed(0) : '?'} — trend too weak.` };
    if (ema20 > ema50 && rsi > 50 && rsi < 70) {
      return { signal: 'BUY',  strength: Math.min(0.95, 0.5 + adx / 100), reason: `Strong uptrend (ADX ${adx.toFixed(0)}, EMA20>EMA50, RSI ${rsi.toFixed(0)}).` };
    }
    if (ema20 < ema50 && rsi < 50 && rsi > 30) {
      return { signal: 'SELL', strength: Math.min(0.95, 0.5 + adx / 100), reason: `Strong downtrend (ADX ${adx.toFixed(0)}, EMA20<EMA50, RSI ${rsi.toFixed(0)}).` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Trend conditions not aligned.' };
  },

  bbReversion(prices) {
    if (prices.length < 30) return null;
    const adx = Indicators.adx(prices, 14);
    if (adx && adx > 28) return { signal: 'HOLD', strength: 0, reason: 'Market trending — skipping reversion.' };
    const bb = Indicators.bollinger(prices, 20, 2);
    const rsi = Indicators.rsi(prices, 14);
    if (!bb || rsi === null) return null;
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

  macdVolume(prices, volumes) {
    if (prices.length < 60) return null;
    const macd = Indicators.macd(prices);
    const obv  = Indicators.obv(prices, volumes);
    if (!macd || obv === null) return null;
    const obvPrev = Indicators.obv(prices.slice(0, -5), volumes.slice(0, -5));
    if (obvPrev === null) return null;
    const obvUp = obv > obvPrev;
    if (macd.hist > 0 && obvUp) {
      return { signal: 'BUY', strength: 0.85, reason: 'MACD bullish + OBV rising — volume confirming the move.' };
    }
    if (macd.hist < 0 && !obvUp) {
      return { signal: 'SELL', strength: 0.8, reason: 'MACD bearish + OBV declining — sellers in control.' };
    }
    return { signal: 'HOLD', strength: 0, reason: 'MACD/volume divergence — waiting.' };
  },

  vwapPullback(prices, volumes) {
    if (prices.length < 30) return null;
    const v = Indicators.vwap(prices.slice(-30), volumes.slice(-30));
    const ema20 = Indicators.ema(prices, 20);
    const last = prices[prices.length - 1];
    if (v === null || ema20 === null) return null;
    const distPct = (last - v) / v;
    if (ema20 > v && distPct < -0.002 && distPct > -0.012) {
      return { signal: 'BUY', strength: 0.7, reason: `Uptrend pullback to VWAP (-${(Math.abs(distPct) * 100).toFixed(2)}%) — buy the dip.` };
    }
    if (ema20 < v && distPct > 0.002 && distPct < 0.012) {
      return { signal: 'SELL', strength: 0.7, reason: `Downtrend retest of VWAP (+${(distPct * 100).toFixed(2)}%) — short the rip.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No clean VWAP retest.' };
  },

  orderFlow(_prices, _volumes, flow) {
    if (!flow || flow.length < 5) return null;
    const last5 = flow.slice(-5);
    const buyVol  = last5.reduce((a, b) => a + b.bid, 0);
    const sellVol = last5.reduce((a, b) => a + b.ask, 0);
    const total = buyVol + sellVol;
    if (total === 0) return null;
    const imbalance = (buyVol - sellVol) / total;
    if (imbalance > 0.35) {
      return { signal: 'BUY', strength: 0.75, reason: `Aggressive buying — bid/ask imbalance +${(imbalance * 100).toFixed(0)}%.` };
    }
    if (imbalance < -0.35) {
      return { signal: 'SELL', strength: 0.75, reason: `Aggressive selling — bid/ask imbalance ${(imbalance * 100).toFixed(0)}%.` };
    }
    return { signal: 'HOLD', strength: 0, reason: 'Order flow balanced.' };
  },

  liquiditySweep(prices) {
    if (prices.length < 40) return null;
    const window = prices.slice(-25);
    const recentHigh = Math.max(...window.slice(0, -3));
    const recentLow  = Math.min(...window.slice(0, -3));
    const sweepHigh  = window.slice(-3).some(p => p > recentHigh * 1.0008);
    const sweepLow   = window.slice(-3).some(p => p < recentLow  * 0.9992);
    const last = prices[prices.length - 1];
    if (sweepHigh && last < recentHigh) {
      return { signal: 'SELL', strength: 0.88, reason: 'Liquidity grab above swing high (SL hunt) then rejected — smart money short.' };
    }
    if (sweepLow && last > recentLow) {
      return { signal: 'BUY', strength: 0.88, reason: 'Stops swept below swing low and reclaimed — smart money long.' };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No liquidity sweep yet.' };
  },

  orderBlock(prices) {
    if (prices.length < 40) return null;
    const last = prices[prices.length - 1];
    for (let i = prices.length - 30; i < prices.length - 6; i++) {
      if (i < 1) continue;
      const bearish = prices[i] < prices[i - 1];
      const bullish = prices[i] > prices[i - 1];
      const slice = prices.slice(i, i + 6);
      const moveUp   = (Math.max(...slice) - prices[i]) / prices[i];
      const moveDown = (prices[i] - Math.min(...slice)) / prices[i];
      if (bearish && moveUp > 0.025) {
        const obLow = Math.min(prices[i - 1], prices[i]);
        const obHigh = Math.max(prices[i - 1], prices[i]);
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

  supplyDemand(prices) {
    if (prices.length < 40) return null;
    const atr = Indicators.atr(prices, 14);
    if (atr === null) return null;
    const lows  = findSwingLows(prices, 40, 3);
    const highs = findSwingHighs(prices, 40, 3);
    const last = prices[prices.length - 1];
    for (let i = lows.length - 1; i >= 0; i--) {
      const sw = lows[i];
      const after = prices.slice(sw.idx + 1, sw.idx + 8);
      if (!after.length) continue;
      const rallied = (Math.max(...after) - sw.price) / sw.price;
      if (rallied > 0.02 && Math.abs(last - sw.price) <= atr * 0.8 && last >= sw.price) {
        return { signal: 'BUY', strength: 0.82, reason: `Demand zone at ${sw.price.toFixed(2)} (prev rally +${(rallied * 100).toFixed(1)}%) — buying retest.` };
      }
    }
    for (let i = highs.length - 1; i >= 0; i--) {
      const sw = highs[i];
      const after = prices.slice(sw.idx + 1, sw.idx + 8);
      if (!after.length) continue;
      const dropped = (sw.price - Math.min(...after)) / sw.price;
      if (dropped > 0.02 && Math.abs(last - sw.price) <= atr * 0.8 && last <= sw.price) {
        return { signal: 'SELL', strength: 0.8, reason: `Supply zone at ${sw.price.toFixed(2)} (prev drop -${(dropped * 100).toFixed(1)}%) — fading retest.` };
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No active supply/demand retest.' };
  },

  trendlineBreak(prices) {
    if (prices.length < 50) return null;
    const lows = findSwingLows(prices, 50, 3);
    const highs = findSwingHighs(prices, 50, 3);
    const last = prices[prices.length - 1];
    const N = prices.length - 1;
    if (lows.length >= 2) {
      const a = lows[lows.length - 2], b = lows[lows.length - 1];
      if (b.idx > a.idx && b.price > a.price) {
        const slope = (b.price - a.price) / (b.idx - a.idx);
        const projected = b.price + slope * (N - b.idx);
        if (last < projected * 0.998) {
          return { signal: 'SELL', strength: 0.76, reason: `Rising trendline broken at ${projected.toFixed(2)} — uptrend invalidated.` };
        }
      }
    }
    if (highs.length >= 2) {
      const a = highs[highs.length - 2], b = highs[highs.length - 1];
      if (b.idx > a.idx && b.price < a.price) {
        const slope = (b.price - a.price) / (b.idx - a.idx);
        const projected = b.price + slope * (N - b.idx);
        if (last > projected * 1.002) {
          return { signal: 'BUY', strength: 0.78, reason: `Falling trendline broken at ${projected.toFixed(2)} — downtrend reversed.` };
        }
      }
    }
    return { signal: 'HOLD', strength: 0, reason: 'No trendline break.' };
  },

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
    if (prevMove < 0 && curMove > 0 && c0 > c2) {
      const lows = findSwingLows(prices, 30, 3);
      const nearLow = lows.length > 0 && Math.abs(c1 - lows[lows.length - 1].price) / c1 < 0.01;
      if (nearLow) return { signal: 'BUY', strength: 0.82, reason: 'Bullish engulfing at swing low — buyers reclaiming control.' };
      return { signal: 'BUY', strength: 0.7, reason: 'Bullish engulfing — momentum shift.' };
    }
    if (prevMove > 0 && curMove < 0 && c0 < c2) {
      const highs = findSwingHighs(prices, 30, 3);
      const nearHigh = highs.length > 0 && Math.abs(c1 - highs[highs.length - 1].price) / c1 < 0.01;
      if (nearHigh) return { signal: 'SELL', strength: 0.82, reason: 'Bearish engulfing at swing high — sellers stepping in.' };
      return { signal: 'SELL', strength: 0.7, reason: 'Bearish engulfing — momentum shift.' };
    }
    return { signal: 'HOLD', strength: 0, reason: 'No engulfing pattern.' };
  },
};

/* =============== ALGO BOT =============== */
export class AlgoBot {
  cfg: BotConfig;
  history: Record<string, number[]> = {};
  volumes: Record<string, number[]> = {};
  flow:    Record<string, OrderFlowTick[]> = {};
  positions: Record<string, Position> = {};
  equity = 10000;
  startEquity = 10000;
  dailyPnl = 0;
  dayStart = new Date().setHours(0, 0, 0, 0);
  log: BotEvent[] = [];
  closedTrades: {
    sym: string; asset: AssetClass; side: Side; qty: number;
    entry: number; exit: number; pl: number; plPct: number;
    kind: CloseKind; time: number; strategy: string;
  }[] = [];
  stats = { wins: 0, losses: 0, grossProfit: 0, grossLoss: 0, total: 0 };
  cooldown: Record<string, number> = {};
  currentMode: Regime = 'UNKNOWN';
  currentStrategies: string[] = [];
  name = 'Vault AI';

  constructor(cfg: Partial<BotConfig> = {}) {
    this.cfg = {
      strategies: ['trendADX', 'bbReversion', 'macdVolume', 'vwapPullback', 'orderFlow'],
      stopLossPct: 0.012,
      takeProfitPct: 0.036,
      trailingActivatePct: 0.012,
      trailingStopPct: 0.008,
      maxOpen: 8,
      riskPerTrade: 0.03,
      dailyLossLimit: 0.05,
      requireConfluence: 2,
      minSignalStrength: 0.7,
      respectFundamentals: true,
      respectRegime: true,
      onlyRegimes: null,
      avoidRegimes: null,
      ...cfg,
    };
  }

  ingest(inst: Instrument, volume: number, flow: OrderFlowTick): void {
    const k = inst.sym;
    this.history[k] ??= [];
    this.volumes[k] ??= [];
    this.flow[k]    ??= [];
    this.history[k].push(inst.price);
    this.volumes[k].push(volume || 1);
    if (flow) this.flow[k].push(flow);
    if (this.history[k].length > 240) this.history[k].shift();
    if (this.volumes[k].length > 240) this.volumes[k].shift();
    if (this.flow[k].length > 60)     this.flow[k].shift();
  }

  protected _managePosition(inst: Instrument): BotEventClose | null {
    const pos = this.positions[inst.sym];
    if (!pos) return null;
    const cur = inst.price;
    const dir = pos.side === 'BUY' ? 1 : -1;
    const plPct = ((cur - pos.entry) / pos.entry) * dir;

    const slPct = pos.stopLossPct        ?? this.cfg.stopLossPct;
    const tpPct = pos.takeProfitPct      ?? this.cfg.takeProfitPct;
    const taPct = pos.trailingActivatePct ?? this.cfg.trailingActivatePct;
    const tsPct = pos.trailingStopPct    ?? this.cfg.trailingStopPct;

    if (plPct <= -slPct)
      return this._close(inst, cur, 'STOP_LOSS', `Stop-loss at -${(slPct * 100).toFixed(2)}% — capital preserved.`);
    if (plPct >= tpPct)
      return this._close(inst, cur, 'TAKE_PROFIT', `Take-profit hit at +${(plPct * 100).toFixed(2)}% — full target reached.`);

    if (plPct >= taPct) {
      if (dir === 1 && cur > pos.peak) pos.peak = cur;
      if (dir === -1 && cur < pos.peak) pos.peak = cur;
      const trailHit = dir === 1
        ? cur <= pos.peak * (1 - tsPct)
        : cur >= pos.peak * (1 + tsPct);
      if (trailHit)
        return this._close(inst, cur, 'TRAILING_STOP', `Trailing stop after +${(plPct * 100).toFixed(2)}% — locking gains.`);
    }
    return null;
  }

  protected _maybeOpen(inst: Instrument): BotEventOpen | null {
    if (this.positions[inst.sym]) return null;
    if (Object.keys(this.positions).length >= this.cfg.maxOpen) return null;
    if (this.dailyPnl <= -this.startEquity * this.cfg.dailyLossLimit) return null;

    const prices  = this.history[inst.sym];
    const volumes = this.volumes[inst.sym];
    const flow    = this.flow[inst.sym];
    if (!prices || prices.length < 60) return null;

    const regime = detectRegime(prices);
    if (this.cfg.respectRegime && regime === 'VOLATILE') return null;
    if (this.cfg.onlyRegimes  && !this.cfg.onlyRegimes.includes(regime)) return null;
    if (this.cfg.avoidRegimes &&  this.cfg.avoidRegimes.includes(regime)) return null;

    const votes: Vote[] = [];
    for (const sName of this.cfg.strategies) {
      const fn = Strategies[sName];
      if (!fn) continue;
      const v = fn(prices, volumes, flow);
      if (v && v.signal !== 'HOLD') votes.push({ ...v, strategy: sName });
    }
    if (!votes.length) return null;

    const buys  = votes.filter(v => v.signal === 'BUY');
    const sells = votes.filter(v => v.signal === 'SELL');
    let pick: Vote[] | null = null;
    let dir: Side | null = null;
    if (buys.length >= this.cfg.requireConfluence && buys.length > sells.length) { pick = buys; dir = 'BUY'; }
    else if (sells.length >= this.cfg.requireConfluence && sells.length > buys.length) { pick = sells; dir = 'SELL'; }
    if (!pick || !dir) return null;

    if (this.cfg.respectRegime) {
      if (dir === 'BUY' && regime === 'TRENDING_DOWN') return null;
      if (dir === 'SELL' && regime === 'TRENDING_UP') return null;
    }
    if (this.cfg.respectFundamentals) {
      const fund = FUNDAMENTALS[inst.sym] ?? 0;
      if (dir === 'BUY' && fund < -0.5) return null;
      if (dir === 'SELL' && fund > 0.5) return null;
    }

    const strength = Math.min(
      0.99,
      pick.reduce((a, v) => a + v.strength, 0) / pick.length + 0.05 * (pick.length - 1),
    );
    if (strength < this.cfg.minSignalStrength) return null;

    return this._open(inst, dir, strength, pick, regime);
  }

  protected _open(inst: Instrument, dir: Side, strength: number, votes: Vote[], regime: Regime): BotEventOpen {
    const price = inst.price;
    const dollars = Math.max(50, this.equity * this.cfg.riskPerTrade);
    const qty = dollars / price;
    const sl = dir === 'BUY' ? price * (1 - this.cfg.stopLossPct)   : price * (1 + this.cfg.stopLossPct);
    const tp = dir === 'BUY' ? price * (1 + this.cfg.takeProfitPct) : price * (1 - this.cfg.takeProfitPct);
    const fund = FUNDAMENTALS[inst.sym] ?? 0;
    const rrTarget = +(this.cfg.takeProfitPct / this.cfg.stopLossPct).toFixed(2);

    const fundLabel = fund >= 0.3 ? 'bullish' : fund <= -0.3 ? 'bearish' : 'neutral';
    const fundBlock = (dir === 'BUY' && fund < -0.5) || (dir === 'SELL' && fund > 0.5);

    const thinking = [
      `1. Market read: ${inst.sym} is in a ${regime.replace('_', ' ').toLowerCase()} regime.`,
      `2. Strategies firing (${votes.length}): ${votes.map(v => v.strategy).join(', ')}.`,
      `3. Direction agreement: all ${votes.length} agreeing strategies favor ${dir}.`,
      `4. Average signal strength: ${(strength * 100).toFixed(0)}% (need ≥${(this.cfg.minSignalStrength * 100).toFixed(0)}%).`,
      `5. Fundamental score: ${fund >= 0 ? '+' : ''}${fund.toFixed(2)} (${fundLabel}) → ${fundBlock ? 'BLOCK' : 'OK'}.`,
      `6. Risk plan: ${(this.cfg.stopLossPct * 100).toFixed(2)}% stop-loss / ${(this.cfg.takeProfitPct * 100).toFixed(2)}% take-profit (${rrTarget}:1 R:R).`,
      `7. Position size: ${(this.cfg.riskPerTrade * 100).toFixed(1)}% of equity = $${dollars.toFixed(0)}.`,
      `8. Decision: ENTER ${dir} at ${price.toFixed(4)}. Trailing stop activates after +${(this.cfg.trailingActivatePct * 100).toFixed(2)}%.`,
    ];

    const pos: Position = {
      id: 'P' + Date.now() + Math.floor(Math.random() * 999),
      sym: inst.sym,
      asset: inst.asset ?? 'crypto',
      side: dir,
      entry: price,
      peak: price,
      qty,
      dollars,
      stopLoss: sl,
      takeProfit: tp,
      stopLossPct: this.cfg.stopLossPct,
      takeProfitPct: this.cfg.takeProfitPct,
      trailingActivatePct: this.cfg.trailingActivatePct,
      trailingStopPct: this.cfg.trailingStopPct,
      strategy: votes.map(v => v.strategy).join(' + '),
      reason: votes.map(v => '• ' + v.reason).join(' '),
      thinking,
      regime,
      strength,
      openedAt: Date.now(),
    };
    this.positions[inst.sym] = pos;

    const ev: BotEventOpen = {
      time: Date.now(),
      sym: inst.sym,
      asset: pos.asset,
      action: dir === 'BUY' ? 'OPEN_LONG' : 'OPEN_SHORT',
      price,
      qty,
      dollars,
      strategy: pos.strategy,
      reason: pos.reason,
      thinking,
      regime,
      strength,
      stopLoss: sl,
      takeProfit: tp,
      rr: rrTarget + ':1',
      fundamental: fund,
    };
    this.log.unshift(ev);
    if (this.log.length > 200) this.log.pop();
    return ev;
  }

  protected _close(inst: Instrument, price: number, kind: CloseKind, reason: string): BotEventClose | null {
    const pos = this.positions[inst.sym];
    if (!pos) return null;
    const dir = pos.side === 'BUY' ? 1 : -1;
    const pl = (price - pos.entry) * pos.qty * dir;
    const plPct = ((price - pos.entry) / pos.entry) * dir;

    delete this.positions[inst.sym];
    this.equity += pl;
    this.dailyPnl += pl;
    this.stats.total += 1;
    if (pl >= 0) { this.stats.wins   += 1; this.stats.grossProfit += pl; }
    else         { this.stats.losses += 1; this.stats.grossLoss   += -pl; }

    if (kind === 'STOP_LOSS') {
      this.cooldown[inst.sym] = Date.now();
    }

    const ev: BotEventClose = {
      time: Date.now(),
      sym: inst.sym,
      asset: pos.asset,
      action: ('CLOSE_' + kind) as BotEventClose['action'],
      price,
      qty: pos.qty,
      pl,
      plPct,
      kind,
      strategy: pos.strategy,
      reason,
      heldMs: Date.now() - pos.openedAt,
    };
    this.log.unshift(ev);
    this.closedTrades.unshift({
      sym: pos.sym, asset: pos.asset, side: pos.side, qty: pos.qty,
      entry: pos.entry, exit: price, pl, plPct, kind,
      time: Date.now(), strategy: pos.strategy,
    });
    if (this.log.length > 200) this.log.pop();
    if (this.closedTrades.length > 100) this.closedTrades.pop();
    return ev;
  }

  step(universe: Instrument[], ctx: StepContext = {}): BotEvent[] {
    const events: BotEvent[] = [];
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
    const today = new Date().setHours(0, 0, 0, 0);
    if (today !== this.dayStart) { this.dayStart = today; this.dailyPnl = 0; }
    return events;
  }

  metrics(): BotMetrics {
    const win = this.stats.total ? this.stats.wins / this.stats.total : 0;
    const avgWin  = this.stats.wins  ? this.stats.grossProfit / this.stats.wins  : 0;
    const avgLoss = this.stats.losses ? this.stats.grossLoss   / this.stats.losses : 0;
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

/* =============== MASTER AI =============== */
export class MasterAI extends AlgoBot {
  constructor() {
    super({
      strategies: [
        'trendADX', 'macdVolume', 'vwapPullback', 'orderFlow',
        'liquiditySweep', 'orderBlock', 'supplyDemand', 'engulfing',
        'trendlineBreak', 'bbReversion',
      ],
      stopLossPct: 0.010,
      takeProfitPct: 0.030,
      trailingActivatePct: 0.010,
      trailingStopPct: 0.006,
      requireConfluence: 2,
      minSignalStrength: 0.74,
      maxOpen: 8,
      riskPerTrade: 0.025,
      respectFundamentals: false,
    });
    this.name = 'Vault AI';
  }

  private _strategiesForRegime(regime: Regime):
    | { strategies: string[]; stopLossPct: number; takeProfitPct: number; minSignalStrength: number; requireConfluence: number }
    | null {
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

  protected override _maybeOpen(inst: Instrument): BotEventOpen | null {
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

    const origStrategies = this.cfg.strategies;
    const origMinStrength = this.cfg.minSignalStrength;

    Object.assign(this.cfg, {
      strategies: cfg.strategies,
      stopLossPct: cfg.stopLossPct,
      takeProfitPct: cfg.takeProfitPct,
      trailingActivatePct: cfg.stopLossPct * 2,
      trailingStopPct: cfg.stopLossPct * 0.8,
      minSignalStrength: cfg.minSignalStrength,
      requireConfluence: cfg.requireConfluence,
    });
    this.currentMode = regime;
    this.currentStrategies = cfg.strategies;

    const votes: Vote[] = [];
    for (const sName of cfg.strategies) {
      const fn = Strategies[sName];
      if (!fn) continue;
      const v = fn(prices, volumes, flow);
      if (v && v.signal !== 'HOLD') votes.push({ ...v, strategy: sName });
    }

    let result: BotEventOpen | null = null;
    if (votes.length) {
      const buys  = votes.filter(v => v.signal === 'BUY');
      const sells = votes.filter(v => v.signal === 'SELL');
      let pick: Vote[] | null = null;
      let dir: Side | null = null;
      if (buys.length >= this.cfg.requireConfluence && buys.length > sells.length) { pick = buys; dir = 'BUY'; }
      else if (sells.length >= this.cfg.requireConfluence && sells.length > buys.length) { pick = sells; dir = 'SELL'; }
      if (pick && dir) {
        let fundOk = true;
        if (this.cfg.respectFundamentals) {
          const fund = FUNDAMENTALS[inst.sym] ?? 0;
          if ((dir === 'BUY' && fund < -0.5) || (dir === 'SELL' && fund > 0.5)) fundOk = false;
        }
        if (fundOk) {
          const strength = Math.min(
            0.99,
            pick.reduce((a, v) => a + v.strength, 0) / pick.length + 0.05 * (pick.length - 1),
          );
          if (strength >= this.cfg.minSignalStrength) {
            result = this._open(inst, dir, strength, pick, regime);
          }
        }
      }
    }

    Object.assign(this.cfg, { strategies: origStrategies, minSignalStrength: origMinStrength });
    return result;
  }
}

export function createBot(_name?: string): MasterAI {
  return new MasterAI();
}

/* =============== BACKTEST / TUNER =============== */
function guessAssetClass(sym: string): AssetClass {
  for (const [cls, list] of Object.entries(MARKETS) as [AssetClass, Instrument[]][]) {
    if (list.some(i => i.sym === sym)) return cls;
  }
  return 'crypto';
}

export function backtest(
  botName = 'Vault Alpha',
  symbols: string[] = ['BTC', 'ETH', 'EURUSD', 'AAPL', 'SPX'],
  bars = 800,
): BotMetrics & { name: string } {
  const bot = createBot(botName);
  const seriesMap: Record<string, { price: number; volume: number }[]> = {};
  symbols.forEach(sym => {
    const fund = FUNDAMENTALS[sym] ?? 0;
    let p = 100;
    const series: { price: number; volume: number }[] = [];
    let regimeBars = 0, regime = 0;
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
  for (let t = 0; t < bars; t++) {
    const universe: Instrument[] = symbols.map(sym => ({
      sym,
      name: sym,
      pair: sym,
      price: seriesMap[sym][t].price,
      chg: 0,
      asset: guessAssetClass(sym),
    }));
    const ctx: StepContext = {
      volumes: Object.fromEntries(symbols.map(s => [s, seriesMap[s][t].volume])),
      flow:    Object.fromEntries(symbols.map(s => [s, simulateFlow({ sym: s })])),
    };
    bot.step(universe, ctx);
  }
  return { name: botName, ...bot.metrics() };
}

export function tuneBot(_baseName = 'Vault Alpha'):
  | { config: Partial<BotConfig>; metrics: BotMetrics }
  | null {
  const variants: Partial<BotConfig>[] = [
    { stopLossPct: 0.010, takeProfitPct: 0.030, requireConfluence: 2, minSignalStrength: 0.70 },
    { stopLossPct: 0.012, takeProfitPct: 0.036, requireConfluence: 2, minSignalStrength: 0.72 },
    { stopLossPct: 0.014, takeProfitPct: 0.042, requireConfluence: 2, minSignalStrength: 0.74 },
    { stopLossPct: 0.012, takeProfitPct: 0.048, requireConfluence: 3, minSignalStrength: 0.78 },
    { stopLossPct: 0.010, takeProfitPct: 0.040, requireConfluence: 2, minSignalStrength: 0.80 },
  ];
  let best: { config: Partial<BotConfig>; metrics: BotMetrics } | null = null;
  for (const v of variants) {
    const bot = new AlgoBot({
      strategies: ['trendADX', 'macdVolume', 'vwapPullback', 'orderFlow'],
      ...v,
    });
    const symbols = ['BTC', 'ETH', 'SOL', 'EURUSD', 'AAPL', 'NVDA', 'SPX'];
    const bars = 800;
    const seriesMap: Record<string, { price: number; volume: number }[]> = {};
    symbols.forEach(sym => {
      let p = 100, rb = 0, regime = 0;
      const series: { price: number; volume: number }[] = [];
      const fund = FUNDAMENTALS[sym] ?? 0;
      for (let i = 0; i < bars; i++) {
        if (rb <= 0) {
          rb = 30 + Math.floor(Math.random() * 80);
          const r = Math.random() + fund * 0.05;
          regime = r < 0.4 ? -1 : r < 0.7 ? 0 : 1;
        }
        p *= 1 + regime * 0.0015 + (Math.random() - 0.5) * 0.012;
        series.push({ price: p, volume: Math.random() * 800 + 200 });
        rb--;
      }
      seriesMap[sym] = series;
    });
    for (let t = 0; t < bars; t++) {
      const universe: Instrument[] = symbols.map(sym => ({
        sym, name: sym, pair: sym, chg: 0,
        price: seriesMap[sym][t].price,
        asset: guessAssetClass(sym),
      }));
      const ctx: StepContext = {
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
