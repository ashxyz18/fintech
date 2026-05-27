import { useMemo } from 'react';

const PB_NAMES: [string, string][] = [
  ['Sarah','London,UK'],['Marcus','Austin,TX'],['Aisha','Dubai,UAE'],['Hiroshi','Tokyo,JP'],
  ['Lukas','Berlin,DE'],['Olivia','Sydney,AU'],['Mateo','Madrid,ES'],['Priya','Mumbai,IN'],
  ['Chen','Shanghai,CN'],['Eva','Stockholm,SE'],['Diego','Mexico City,MX'],['Noah','Toronto,CA'],
  ['Emma','Paris,FR'],['Lars','Oslo,NO'],['Yusuf','Istanbul,TR'],['Ananya','Bangalore,IN'],
  ['Liam','Dublin,IE'],['Mia','Auckland,NZ'],['Carlos','São Paulo,BR'],['Zoe','Cape Town,ZA'],
];

interface PayoutItem { name: string; city: string; amt: number; ago: string }

function pbAmount(): number {
  const r = Math.random();
  if (r < 0.55) return Math.round((200 + Math.random() * 1800) / 10) * 10;
  if (r < 0.85) return Math.round((2000 + Math.random() * 6000) / 50) * 50;
  if (r < 0.97) return Math.round((8000 + Math.random() * 18000) / 100) * 100;
  return Math.round((25000 + Math.random() * 75000) / 500) * 500;
}
function pbAgo(): string {
  const m = Math.floor(Math.random() * 12) + 1;
  return m === 1 ? 'just now' : m + 'm ago';
}
function buildItems(n: number): PayoutItem[] {
  const out: PayoutItem[] = [];
  for (let i = 0; i < n; i++) {
    const [name, city] = PB_NAMES[Math.floor(Math.random() * PB_NAMES.length)];
    out.push({ name, city, amt: pbAmount(), ago: pbAgo() });
  }
  return out;
}

/* In-app live withdrawals strip — shown above app pages
   (Dashboard / Trading / Markets / Deposit / Withdraw). */
export function PayoutBar() {
  const { items, total } = useMemo(() => {
    const items = buildItems(14);
    const total = 1840000 + Math.floor(Math.random() * 60000);
    return { items, total };
  }, []);

  const row = (
    <>
      {items.map((it, i) => (
        <span key={i} className="pb-item">
          <span className="pb-icon"><i className="fa-solid fa-arrow-up"></i></span>
          <span className="pb-who">{it.name}</span>
          <span className="text-mute">from</span>
          <span>{it.city}</span>
          <span className="text-mute">·</span>
          <span>just withdrew</span>
          <span className="pb-amt">${it.amt.toLocaleString()}</span>
          <span className="text-mute">{it.ago}</span>
        </span>
      ))}
    </>
  );

  return (
    <div className="payout-bar">
      <div className="pb-label"><span className="dot" /> Live payouts</div>
      <div className="pb-track">
        <div className="pb-row">
          {row}
          {row}
        </div>
      </div>
      <div className="pb-total">
        <i className="fa-solid fa-shield"></i> <strong>${total.toLocaleString()}</strong> paid · 24h
      </div>
    </div>
  );
}
