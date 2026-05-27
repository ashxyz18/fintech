import type { Account, AssetClass, Holding, Movement, Side, Trade, Transfer, User } from '../types';

const AUTH_KEY = 'cv_user';
const ACCT_KEY = 'cv_account';

/* ---------------- USER ---------------- */
export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUser(u: User): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(u));
}

export function clearUser(): void {
  localStorage.removeItem(AUTH_KEY);
}

/* ---------------- ACCOUNT ---------------- */
export function getAccount(): Account {
  let a: Account | null = null;
  try {
    const raw = localStorage.getItem(ACCT_KEY);
    a = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    a = null;
  }
  if (!a) {
    a = seedAccount();
    localStorage.setItem(ACCT_KEY, JSON.stringify(a));
  }
  // Defensive migration for old shapes.
  if (!a.wallets) {
    a.wallets = {
      main:    { balance: +(a.available || a.balance * 0.30).toFixed(2) },
      trading: { balance: +(a.invested  || a.balance * 0.70).toFixed(2) },
    };
  }
  if (!a.transfers) a.transfers = [];
  return a;
}

export function setAccount(a: Account): void {
  localStorage.setItem(ACCT_KEY, JSON.stringify(a));
}

export function resetAccount(): void {
  localStorage.removeItem(ACCT_KEY);
}

/* ---------------- SEED ----------------
   60-day equity curve, 30 historical trades, sample holdings/movements.
   Matches js/main.js seedAccount() so users see the same opening state
   they had on the vanilla site if they migrate.
*/
export function seedAccount(): Account {
  const now = Date.now();
  const startBalance = 10000;
  const trades: Trade[] = [];

  type TradeSeed = [string, AssetClass, Side, number, number, number, number];
  const samples: TradeSeed[] = [
    ['BTC',   'crypto',  'BUY',  0.12,    65800,  67420,  +194.4],
    ['ETH',   'crypto',  'BUY',  3.5,     3120,   3247,   +444.5],
    ['EURUSD','forex',   'BUY',  10000,   1.0810, 1.0842, +32.0],
    ['AAPL',  'stocks',  'BUY',  20,      214.20, 218.42, +84.4],
    ['NVDA',  'stocks',  'BUY',  40,      138.40, 142.71, +172.4],
    ['SPX',   'indices', 'BUY',  1,       5810,   5847,   +37.0],
    ['SOL',   'crypto',  'SELL', 12,      182.40, 178.42, +47.8],
    ['GBPUSD','forex',   'SELL', 8000,    1.2754, 1.2731, +18.4],
    ['TSLA',  'stocks',  'BUY',  10,      330.10, 342.18, +120.8],
    ['NDX',   'indices', 'BUY',  1,       20680,  20847,  +167.0],
    ['DOGE',  'crypto',  'BUY',  5000,    0.1462, 0.1582, +60.0],
    ['USDJPY','forex',   'BUY',  10000,   156.10, 156.82, +46.2],
    ['MSFT',  'stocks',  'BUY',  8,       418.20, 421.84, +29.1],
    ['XRP',   'crypto',  'SELL', 4000,    0.5891, 0.5824, +26.8],
    ['BNB',   'crypto',  'BUY',  4,       604.20, 612.30, +32.4],
    ['DAX',   'indices', 'BUY',  1,       19284,  19421,  +137.0],
    ['ADA',   'crypto',  'BUY',  3000,    0.4421, 0.4621, +60.0],
    ['AMZN',  'stocks',  'BUY',  10,      192.10, 198.32, +62.2],
    ['GOOGL', 'stocks',  'BUY',  10,      174.20, 178.61, +44.1],
    ['AVAX',  'crypto',  'BUY',  20,      36.42,  38.92,  +50.0],
    ['FTSE',  'indices', 'SELL', 1,       8312,   8284,   +28.0],
    ['LINK',  'crypto',  'BUY',  50,      17.21,  18.47,  +63.0],
    ['META',  'stocks',  'SELL', 5,       572.40, 564.27, +40.6],
    ['NKY',   'indices', 'BUY',  1,       37840,  38247,  +407.0],
    ['EURUSD','forex',   'SELL', 5000,    1.0871, 1.0842, +14.5],
    ['DOT',   'crypto',  'SELL', 100,     7.42,   7.24,   +18.0],
    ['JPM',   'stocks',  'BUY',  10,      214.20, 218.94, +47.4],
    ['V',     'stocks',  'BUY',  10,      284.10, 287.42, +33.2],
    ['NZDUSD','forex',   'BUY',  10000,   0.5984, 0.6014, +30.0],
    ['BTC',   'crypto',  'SELL', 0.05,    66100,  67420, -66.0],
  ];
  samples.forEach(([sym, asset, side, qty, entry, exit, pl], i) => {
    trades.push({
      id: 'T' + (10000 + i),
      sym, asset, side, qty, entry, exit, pl,
      time: now - (i + 1) * (Math.random() * 4 + 1) * 60 * 60 * 1000,
      bot: i % 4 !== 0 ? 'Vault Alpha' : 'Macro Pro',
      status: 'CLOSED',
    });
  });

  const holdings: Holding[] = [
    { sym: 'BTC',    asset: 'crypto',  qty: 0.34,  avg: 64200,   value: 22923 },
    { sym: 'ETH',    asset: 'crypto',  qty: 4.2,   avg: 3010,    value: 13641 },
    { sym: 'SOL',    asset: 'crypto',  qty: 18,    avg: 162,     value: 3211 },
    { sym: 'AAPL',   asset: 'stocks',  qty: 25,    avg: 210.40,  value: 5460 },
    { sym: 'NVDA',   asset: 'stocks',  qty: 30,    avg: 132.10,  value: 4281 },
    { sym: 'EURUSD', asset: 'forex',   qty: 50000, avg: 1.0810,  value: 54210 },
    { sym: 'SPX',    asset: 'indices', qty: 2,     avg: 5780,    value: 11694 },
    { sym: 'US10Y',  asset: 'bonds',   qty: 50,    avg: 4.18,    value: 5210 },
  ];

  const equity: Account['equity'] = [];
  let v = startBalance;
  for (let d = 60; d >= 0; d--) {
    const drift = 0.004 + (Math.random() - 0.42) * 0.02;
    v = v * (1 + drift);
    equity.push({ t: now - d * 24 * 3600 * 1000, v: Math.round(v * 100) / 100 });
  }
  const balance = Math.round(equity[equity.length - 1].v * 100) / 100;

  const transfers: Transfer[] = [
    { id: 'X3001', from: 'main',    to: 'trading', amount: 5000, time: now - 40 * 86400000 },
    { id: 'X3002', from: 'main',    to: 'trading', amount: 3000, time: now - 22 * 86400000 },
    { id: 'X3003', from: 'trading', to: 'main',    amount: 1200, time: now -  8 * 86400000 },
  ];
  const deposits: Movement[] = [
    { id: 'D1001', amount: 5000, method: 'Wire', status: 'COMPLETED', time: now - 50 * 86400000 },
    { id: 'D1002', amount: 3000, method: 'Card', status: 'COMPLETED', time: now - 30 * 86400000 },
    { id: 'D1003', amount: 2000, method: 'BTC',  status: 'COMPLETED', time: now - 12 * 86400000 },
  ];
  const withdrawals: Movement[] = [
    { id: 'W2001', amount: 800, method: 'Bank', status: 'COMPLETED', time: now - 18 * 86400000 },
  ];

  return {
    balance,
    available: Math.round(balance * 0.35 * 100) / 100,
    invested:  Math.round(balance * 0.65 * 100) / 100,
    wallets: {
      main:    { balance: Math.round(balance * 0.30 * 100) / 100 },
      trading: { balance: Math.round(balance * 0.70 * 100) / 100 },
    },
    pnlAllTime: Math.round((balance - startBalance) * 100) / 100,
    pnl30d: Math.round(balance * 0.184 * 100) / 100,
    winRate: 84,
    trades,
    holdings,
    equity,
    transfers,
    deposits,
    withdrawals,
  };
}
