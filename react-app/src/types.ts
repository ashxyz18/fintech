/* =============================================================
   CryptoVault — Shared types
   These mirror the data shapes used by the original vanilla site
   so the React port behaves identically end-to-end.
   ============================================================= */

export type AssetClass =
  | 'crypto'
  | 'forex'
  | 'stocks'
  | 'indices'
  | 'bonds'
  | 'futures';

export interface Instrument {
  sym: string;
  name: string;
  pair: string;
  price: number;
  chg: number;
  iconClass?: string;
  icon?: string;
  asset?: AssetClass;
  leverage?: number;
}

export type MarketsByClass = Record<AssetClass, Instrument[]>;

/* ---------- Auth ---------- */
export interface User {
  email: string;
  name?: string;
  createdAt: number;
}

/* ---------- Account / Wallets / Trades ---------- */
export type Side = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED';

export interface Wallet {
  balance: number;
}

export interface Wallets {
  main: Wallet;
  trading: Wallet;
}

export interface Trade {
  id: string;
  sym: string;
  asset: AssetClass;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
  pl: number;
  time: number;
  bot: string;
  status: TradeStatus;
}

export interface Holding {
  sym: string;
  asset: AssetClass;
  qty: number;
  avg: number;
  value: number;
}

export interface EquityPoint {
  t: number;
  v: number;
}

export interface Transfer {
  id: string;
  from: 'main' | 'trading';
  to: 'main' | 'trading';
  amount: number;
  time: number;
}

export interface Movement {
  id: string;
  amount: number;
  method: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  time: number;
}

export interface Account {
  balance: number;
  available: number;
  invested: number;
  wallets: Wallets;
  pnlAllTime: number;
  pnl30d: number;
  winRate: number;
  trades: Trade[];
  holdings: Holding[];
  equity: EquityPoint[];
  transfers: Transfer[];
  deposits: Movement[];
  withdrawals: Movement[];
}

/* ---------- Algo engine ---------- */
export type Regime =
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'RANGING'
  | 'VOLATILE'
  | 'UNKNOWN';

export type SignalKind = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
  signal: SignalKind;
  strength: number;
  reason: string;
}

export interface Vote extends Signal {
  strategy: string;
}

export interface OrderFlowTick {
  bid: number;
  ask: number;
  time: number;
}

export type CloseKind =
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'TRAILING_STOP';

export interface Position {
  id: string;
  sym: string;
  asset: AssetClass;
  side: Side;
  entry: number;
  peak: number;
  qty: number;
  dollars: number;
  stopLoss: number;
  takeProfit: number;
  stopLossPct: number;
  takeProfitPct: number;
  trailingActivatePct: number;
  trailingStopPct: number;
  strategy: string;
  reason: string;
  thinking: string[];
  regime: Regime;
  strength: number;
  openedAt: number;
}

export interface BotEventOpen {
  time: number;
  sym: string;
  asset: AssetClass;
  action: 'OPEN_LONG' | 'OPEN_SHORT';
  price: number;
  qty: number;
  dollars: number;
  strategy: string;
  reason: string;
  thinking: string[];
  regime: Regime;
  strength: number;
  stopLoss: number;
  takeProfit: number;
  rr: string;
  fundamental: number;
}

export interface BotEventClose {
  time: number;
  sym: string;
  asset: AssetClass;
  action: 'CLOSE_STOP_LOSS' | 'CLOSE_TAKE_PROFIT' | 'CLOSE_TRAILING_STOP';
  price: number;
  qty: number;
  pl: number;
  plPct: number;
  kind: CloseKind;
  strategy: string;
  reason: string;
  heldMs: number;
}

export type BotEvent = BotEventOpen | BotEventClose;

export interface BotMetrics {
  total: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  rr: number;
  profitFactor: number;
  expectancy: number;
  netPnl: number;
}

export interface BotConfig {
  strategies: string[];
  stopLossPct: number;
  takeProfitPct: number;
  trailingActivatePct: number;
  trailingStopPct: number;
  maxOpen: number;
  riskPerTrade: number;
  dailyLossLimit: number;
  requireConfluence: number;
  minSignalStrength: number;
  respectFundamentals: boolean;
  respectRegime: boolean;
  onlyRegimes: Regime[] | null;
  avoidRegimes: Regime[] | null;
}

export interface StepContext {
  volumes?: Record<string, number>;
  flow?: Record<string, OrderFlowTick>;
}
