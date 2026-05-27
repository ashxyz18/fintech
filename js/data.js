/* ===========================================================
   CRYPTOVAULT - MARKET DATA
   Multi-asset universe: Crypto, Forex, Stocks, Indices, Bonds
   =========================================================== */

const MARKETS = {
  crypto: [
    { sym: 'BTC',   name: 'Bitcoin',     pair: 'BTC/USD',  price: 67420.50, chg: 4.21,  iconClass: 'coin-btc',  icon: '₿' },
    { sym: 'ETH',   name: 'Ethereum',    pair: 'ETH/USD',  price: 3247.80,  chg: 2.84,  iconClass: 'coin-eth',  icon: 'Ξ' },
    { sym: 'SOL',   name: 'Solana',      pair: 'SOL/USD',  price: 178.42,   chg: 6.15,  iconClass: 'coin-sol',  icon: 'S' },
    { sym: 'BNB',   name: 'BNB',         pair: 'BNB/USD',  price: 612.30,   chg: 1.42,  iconClass: 'coin-bnb',  icon: 'B' },
    { sym: 'XRP',   name: 'Ripple',      pair: 'XRP/USD',  price: 0.5824,   chg: -1.12, iconClass: 'coin-xrp',  icon: 'X' },
    { sym: 'ADA',   name: 'Cardano',     pair: 'ADA/USD',  price: 0.4621,   chg: 3.78,  iconClass: 'coin-ada',  icon: 'A' },
    { sym: 'DOGE',  name: 'Dogecoin',    pair: 'DOGE/USD', price: 0.1582,   chg: 8.42,  iconClass: 'coin-doge', icon: 'Ð' },
    { sym: 'DOT',   name: 'Polkadot',    pair: 'DOT/USD',  price: 7.24,     chg: -2.30, iconClass: 'coin-dot',  icon: '●' },
    { sym: 'AVAX',  name: 'Avalanche',   pair: 'AVAX/USD', price: 38.92,    chg: 5.61,  iconClass: 'coin-btc',  icon: 'V' },
    { sym: 'LINK',  name: 'Chainlink',   pair: 'LINK/USD', price: 18.47,    chg: 2.18,  iconClass: 'coin-eth',  icon: 'L' },
  ],
  forex: [
    { sym: 'EURUSD', name: 'Euro / US Dollar',          pair: 'EUR/USD', price: 1.0842, chg: 0.18,  iconClass: 'fx-eur', icon: '€' },
    { sym: 'GBPUSD', name: 'British Pound / US Dollar', pair: 'GBP/USD', price: 1.2731, chg: -0.24, iconClass: 'fx-gbp', icon: '£' },
    { sym: 'USDJPY', name: 'US Dollar / Japanese Yen',  pair: 'USD/JPY', price: 156.82, chg: 0.42,  iconClass: 'fx-jpy', icon: '¥' },
    { sym: 'AUDUSD', name: 'Australian / US Dollar',    pair: 'AUD/USD', price: 0.6612, chg: 0.31,  iconClass: 'fx-aud', icon: 'A$' },
    { sym: 'USDCAD', name: 'US Dollar / Canadian',      pair: 'USD/CAD', price: 1.3654, chg: -0.12, iconClass: 'fx-cad', icon: 'C$' },
    { sym: 'USDCHF', name: 'US Dollar / Swiss Franc',   pair: 'USD/CHF', price: 0.8921, chg: 0.07,  iconClass: 'fx-chf', icon: '₣' },
    { sym: 'NZDUSD', name: 'New Zealand / US Dollar',   pair: 'NZD/USD', price: 0.6014, chg: 0.22,  iconClass: 'fx-nzd', icon: 'NZ' },
    { sym: 'EURGBP', name: 'Euro / British Pound',      pair: 'EUR/GBP', price: 0.8516, chg: -0.09, iconClass: 'fx-eur', icon: '€' },
  ],
  stocks: [
    { sym: 'AAPL',  name: 'Apple Inc.',         pair: 'NASDAQ', price: 218.42, chg: 1.24,  iconClass: 'stk-aapl', icon: '' },
    { sym: 'TSLA',  name: 'Tesla Inc.',         pair: 'NASDAQ', price: 342.18, chg: 3.82,  iconClass: 'stk-tsla', icon: 'T' },
    { sym: 'NVDA',  name: 'NVIDIA Corp.',       pair: 'NASDAQ', price: 142.71, chg: 5.14,  iconClass: 'stk-nvda', icon: 'N' },
    { sym: 'MSFT',  name: 'Microsoft Corp.',    pair: 'NASDAQ', price: 421.84, chg: 0.92,  iconClass: 'stk-msft', icon: 'M' },
    { sym: 'AMZN',  name: 'Amazon.com Inc.',    pair: 'NASDAQ', price: 198.32, chg: 2.18,  iconClass: 'stk-amzn', icon: 'a' },
    { sym: 'GOOGL', name: 'Alphabet Inc.',      pair: 'NASDAQ', price: 178.61, chg: 1.42,  iconClass: 'stk-googl', icon: 'G' },
    { sym: 'META',  name: 'Meta Platforms',     pair: 'NASDAQ', price: 564.27, chg: -0.84, iconClass: 'stk-meta', icon: 'M' },
    { sym: 'JPM',   name: 'JPMorgan Chase',     pair: 'NYSE',   price: 218.94, chg: 0.42,  iconClass: 'stk-jpm', icon: 'J' },
    { sym: 'BRK.B', name: 'Berkshire Hathaway', pair: 'NYSE',   price: 432.18, chg: 0.31,  iconClass: 'stk-brk', icon: 'B' },
    { sym: 'V',     name: 'Visa Inc.',          pair: 'NYSE',   price: 287.42, chg: 0.71,  iconClass: 'stk-v', icon: 'V' },
  ],
  indices: [
    { sym: 'SPX',   name: 'S&P 500',           pair: 'US500',   price: 5847.32, chg: 0.42,  iconClass: 'idx-spx', icon: 'S' },
    { sym: 'NDX',   name: 'NASDAQ 100',        pair: 'US100',   price: 20847.84, chg: 0.87, iconClass: 'idx-ndx', icon: 'N' },
    { sym: 'DJI',   name: 'Dow Jones',         pair: 'US30',    price: 43218.42, chg: 0.18, iconClass: 'idx-dji', icon: 'D' },
    { sym: 'FTSE',  name: 'FTSE 100',          pair: 'UK100',   price: 8284.62, chg: -0.24,  iconClass: 'idx-ftse', icon: 'F' },
    { sym: 'DAX',   name: 'DAX 40',            pair: 'GER40',   price: 19421.18, chg: 0.31, iconClass: 'idx-dax', icon: 'D' },
    { sym: 'NKY',   name: 'Nikkei 225',        pair: 'JPN225',  price: 38247.92, chg: 1.12, iconClass: 'idx-nky', icon: 'N' },
    { sym: 'HSI',   name: 'Hang Seng',         pair: 'HK50',    price: 19842.18, chg: -0.62, iconClass: 'idx-hsi', icon: 'H' },
    { sym: 'CAC',   name: 'CAC 40',            pair: 'FRA40',   price: 7421.84, chg: 0.18, iconClass: 'idx-cac', icon: 'C' },
  ],
  bonds: [
    { sym: 'US10Y', name: 'US 10-Year Treasury',  pair: 'TNX',  price: 4.218, chg: 0.04, iconClass: 'bnd-us', icon: 'US' },
    { sym: 'US30Y', name: 'US 30-Year Treasury',  pair: 'TYX',  price: 4.642, chg: 0.02, iconClass: 'bnd-us', icon: 'US' },
    { sym: 'US2Y',  name: 'US 2-Year Treasury',   pair: 'UST2', price: 4.318, chg: -0.01, iconClass: 'bnd-us', icon: 'US' },
    { sym: 'DE10Y', name: 'German 10Y Bund',      pair: 'BUND', price: 2.418, chg: 0.03, iconClass: 'bnd-de', icon: 'DE' },
    { sym: 'UK10Y', name: 'UK 10-Year Gilt',      pair: 'GILT', price: 4.184, chg: 0.05, iconClass: 'bnd-uk', icon: 'UK' },
    { sym: 'JP10Y', name: 'Japan 10-Year JGB',    pair: 'JGB',  price: 1.082, chg: 0.01, iconClass: 'bnd-jp', icon: 'JP' },
    { sym: 'CORP',  name: 'iShares Corp Bond',    pair: 'LQD',  price: 108.42, chg: 0.18, iconClass: 'bnd-us', icon: 'LQD' },
    { sym: 'HY',    name: 'iShares High Yield',   pair: 'HYG',  price: 78.94, chg: 0.12, iconClass: 'bnd-us', icon: 'HYG' },
  ],
  futures: [
    { sym: 'BTC-PERP', name: 'Bitcoin Perpetual',     pair: 'BTC-USDT', price: 67452.10, chg: 4.32,  iconClass: 'fut-btc', icon: 'B', leverage: 100 },
    { sym: 'ETH-PERP', name: 'Ethereum Perpetual',    pair: 'ETH-USDT', price: 3251.40,  chg: 2.91,  iconClass: 'fut-eth', icon: 'E', leverage: 75 },
    { sym: 'SOL-PERP', name: 'Solana Perpetual',      pair: 'SOL-USDT', price: 178.92,   chg: 6.42,  iconClass: 'fut-sol', icon: 'S', leverage: 50 },
    { sym: 'ES',       name: 'E-mini S&P 500 Future', pair: 'ES1!',     price: 5854.25,  chg: 0.48,  iconClass: 'fut-es',  icon: 'ES', leverage: 20 },
    { sym: 'NQ',       name: 'E-mini NASDAQ Future',  pair: 'NQ1!',     price: 20861.50, chg: 0.92,  iconClass: 'fut-nq',  icon: 'NQ', leverage: 20 },
    { sym: 'YM',       name: 'E-mini Dow Future',     pair: 'YM1!',     price: 43242.00, chg: 0.21,  iconClass: 'fut-ym',  icon: 'YM', leverage: 20 },
    { sym: 'CL',       name: 'WTI Crude Oil Future',  pair: 'CL1!',     price: 71.84,    chg: -0.62, iconClass: 'fut-cl',  icon: 'CL', leverage: 25 },
    { sym: 'GC',       name: 'Gold Future',           pair: 'GC1!',     price: 2641.20,  chg: 0.31,  iconClass: 'fut-gc',  icon: 'GC', leverage: 25 },
  ],
};

// Flatten for ticker / search
const ALL_INSTRUMENTS = Object.entries(MARKETS).flatMap(([cls, arr]) =>
  arr.map(a => ({ ...a, asset: cls }))
);

// Format helpers
function fmtPrice(asset, price) {
  if (asset === 'forex') return price.toFixed(4);
  if (asset === 'bonds') return price.toFixed(3) + '%';
  if (asset === 'crypto' && price < 1) return '$' + price.toFixed(4);
  if (asset === 'crypto') return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (asset === 'futures') return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChg(chg) {
  const sign = chg >= 0 ? '+' : '';
  return sign + chg.toFixed(2) + '%';
}
function fmtMoney(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Asset-class metadata for UI
const ASSET_META = {
  crypto:  { label: 'Crypto',  icon: 'fa-brands fa-bitcoin',     color: '#f7931a' },
  forex:   { label: 'Forex',   icon: 'fa-solid fa-money-bill-trend-up', color: '#1f6dff' },
  stocks:  { label: 'Stocks',  icon: 'fa-solid fa-chart-line',   color: '#00ffa3' },
  indices: { label: 'Indices', icon: 'fa-solid fa-chart-pie',    color: '#ffb800' },
  bonds:   { label: 'Bonds',   icon: 'fa-solid fa-landmark',     color: '#ff2a4d' },
  futures: { label: 'Futures', icon: 'fa-solid fa-rocket',       color: '#a855f7' },
};
