import type { AssetClass, Instrument } from '../types';

export function fmtPrice(asset: AssetClass | undefined, price: number): string {
  switch (asset) {
    case 'forex':
      return price.toFixed(4);
    case 'bonds':
      return price.toFixed(3) + '%';
    case 'crypto':
      if (price < 1) return '$' + price.toFixed(4);
      return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

export function fmtChg(chg: number): string {
  return (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
}

export function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoneyCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return fmtMoney(n);
}

/* ---------- Live price tick (random walk) ---------- */
export function tickPrice(inst: Instrument): Instrument {
  const vol =
    inst.asset === 'crypto'  ? 0.0025 :
    inst.asset === 'forex'   ? 0.0004 :
    inst.asset === 'stocks'  ? 0.0015 :
    inst.asset === 'indices' ? 0.0010 :
    inst.asset === 'futures' ? 0.0030 :
    0.0005;
  const drift = (Math.random() - 0.5) * vol;
  inst.price = +(inst.price * (1 + drift)).toFixed(inst.asset === 'forex' ? 5 : 2);
  inst.chg = +(inst.chg + (Math.random() - 0.5) * 0.05).toFixed(2);
  return inst;
}
