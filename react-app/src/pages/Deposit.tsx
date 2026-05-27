import { useState } from 'react';
import { useAccount } from '../lib/useAccount';
import { useToast } from '../components/Toast';
import { fmtMoney } from '../lib/format';
import type { Movement } from '../types';

const METHODS = [
  { id: 'card', label: 'Debit / Credit card', icon: 'fa-credit-card', desc: 'Visa · Mastercard · Amex · Instant' },
  { id: 'bank', label: 'Bank transfer (ACH/SEPA)', icon: 'fa-building-columns', desc: '0% fees · 1-3 business days' },
  { id: 'btc',  label: 'Crypto (BTC / ETH / USDT)', icon: 'fa-brands fa-bitcoin', desc: 'On-chain · 1 confirmation' },
];

export function Deposit() {
  const [account, update] = useAccount();
  const { toast } = useToast();
  const [method, setMethod] = useState('card');
  const [amount, setAmount] = useState(500);

  function deposit() {
    const amt = Math.max(50, +amount);
    if (!amt) return;
    const dep: Movement = {
      id: 'D' + Date.now(),
      amount: amt,
      method: METHODS.find(m => m.id === method)?.label.split(' ')[0] ?? 'Card',
      status: 'COMPLETED',
      time: Date.now(),
    };
    update(prev => ({
      ...prev,
      balance: +(prev.balance + amt).toFixed(2),
      wallets: {
        ...prev.wallets,
        main: { balance: +(prev.wallets.main.balance + amt).toFixed(2) },
      },
      deposits: [dep, ...prev.deposits],
    }));
    toast(`Deposited ${fmtMoney(amt)} to main wallet`);
  }

  return (
    <div className="app-section">
      <div className="page-head">
        <div>
          <h1>Deposit funds</h1>
          <div className="sub">Add money to your <strong>main wallet</strong>. Transfer to trading anytime.</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3 className="mb-md">Choose a method</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className="card"
                style={{
                  padding: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderColor: method === m.id ? 'var(--border-glow)' : 'var(--border)',
                  background: method === m.id ? 'rgba(31,109,255,0.08)' : 'var(--bg-card)',
                }}
              >
                <div className="flex gap-md" style={{ alignItems: 'center' }}>
                  <div className="feature-icon" style={{ width: 38, height: 38, fontSize: '1rem' }}>
                    <i className={`fa-solid ${m.icon}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{m.label}</strong>
                    <div className="text-mute" style={{ fontSize: '0.8rem' }}>{m.desc}</div>
                  </div>
                  {method === m.id && <i className="fa-solid fa-check text-green" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-md">Amount</h3>
          <div className="amount-input-wrap">
            <input
              type="number"
              className="amount-input"
              min={50}
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value || '0'))}
              placeholder="$500"
            />
          </div>
          <div className="preset-amounts">
            {[100, 500, 1000, 5000].map(p => (
              <button key={p} onClick={() => setAmount(p)}>${p.toLocaleString()}</button>
            ))}
          </div>
          <button className="btn btn-primary btn-block btn-lg" onClick={deposit}>
            <i className="fa-solid fa-plus" /> Deposit {fmtMoney(Math.max(50, amount || 0))}
          </button>
          <div className="text-mute mt-md text-center" style={{ fontSize: '0.78rem' }}>
            <i className="fa-solid fa-shield" /> No fees on first $1,000 · Insured up to $250M
          </div>
        </div>
      </div>

      <div className="card mt-lg">
        <h3 className="mb-md">Recent deposits</h3>
        {account.deposits.length === 0 ? (
          <div className="text-dim" style={{ padding: 20 }}>No deposits yet.</div>
        ) : (
          account.deposits.slice(0, 8).map(d => (
            <div key={d.id} className="flex flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{fmtMoney(d.amount)}</strong>
                <div className="text-mute" style={{ fontSize: '0.78rem' }}>{d.method} · {new Date(d.time).toLocaleString()}</div>
              </div>
              <span className="tag tag-buy">{d.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
