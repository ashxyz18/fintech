import { useState } from 'react';
import { useAccount } from '../lib/useAccount';
import { useToast } from '../components/Toast';
import { fmtMoney } from '../lib/format';
import type { Movement } from '../types';

const METHODS = [
  { id: 'bank', label: 'Bank transfer', icon: 'fa-building-columns', desc: 'ACH/SEPA · ~22 min average' },
  { id: 'btc',  label: 'Crypto wallet (BTC)', icon: 'fa-brands fa-bitcoin', desc: 'On-chain · 1 confirmation' },
  { id: 'usdt', label: 'Stablecoin (USDT)', icon: 'fa-coins', desc: 'TRC-20 · ~10 min' },
];

export function Withdraw() {
  const [account, update] = useAccount();
  const { toast } = useToast();
  const [method, setMethod] = useState('bank');
  const [amount, setAmount] = useState(250);

  const max = account.wallets.main.balance;

  function withdraw() {
    const amt = Math.max(10, +amount);
    if (amt > max) {
      toast(`Insufficient main wallet (${fmtMoney(max)} available)`, 'error');
      return;
    }
    const w: Movement = {
      id: 'W' + Date.now(),
      amount: amt,
      method: METHODS.find(m => m.id === method)?.label.split(' ')[0] ?? 'Bank',
      status: 'PENDING',
      time: Date.now(),
    };
    update(prev => ({
      ...prev,
      balance: +(prev.balance - amt).toFixed(2),
      wallets: {
        ...prev.wallets,
        main: { balance: +(prev.wallets.main.balance - amt).toFixed(2) },
      },
      withdrawals: [w, ...prev.withdrawals],
    }));
    toast(`Withdrawal of ${fmtMoney(amt)} initiated`);

    // Demo: complete after 2s
    setTimeout(() => {
      update(prev => ({
        ...prev,
        withdrawals: prev.withdrawals.map(x =>
          x.id === w.id ? { ...x, status: 'COMPLETED' } : x,
        ),
      }));
      toast(`Withdrawal of ${fmtMoney(amt)} completed`);
    }, 2000);
  }

  return (
    <div className="app-section">
      <div className="page-head">
        <div>
          <h1>Withdraw funds</h1>
          <div className="sub">From your <strong>main wallet</strong>. Available: <strong>{fmtMoney(max)}</strong></div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3 className="mb-md">Destination</h3>
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
              min={10}
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value || '0'))}
              placeholder="$250"
            />
          </div>
          <div className="preset-amounts">
            {[0.25, 0.5, 0.75, 1].map(p => (
              <button key={p} onClick={() => setAmount(+(max * p).toFixed(2))}>
                {p === 1 ? 'MAX' : `${p * 100}%`}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block btn-lg" onClick={withdraw}>
            <i className="fa-solid fa-arrow-up" /> Withdraw {fmtMoney(Math.max(10, amount || 0))}
          </button>
          <div className="text-mute mt-md text-center" style={{ fontSize: '0.78rem' }}>
            <i className="fa-solid fa-shield" /> No lockups · Average payout time 22 min
          </div>
        </div>
      </div>

      <div className="card mt-lg">
        <h3 className="mb-md">Recent withdrawals</h3>
        {account.withdrawals.length === 0 ? (
          <div className="text-dim" style={{ padding: 20 }}>No withdrawals yet.</div>
        ) : (
          account.withdrawals.slice(0, 8).map(w => (
            <div key={w.id} className="flex flex-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{fmtMoney(w.amount)}</strong>
                <div className="text-mute" style={{ fontSize: '0.78rem' }}>{w.method} · {new Date(w.time).toLocaleString()}</div>
              </div>
              <span className={`tag ${w.status === 'COMPLETED' ? 'tag-buy' : ''}`} style={{ background: w.status === 'PENDING' ? 'rgba(255,184,0,0.15)' : undefined, color: w.status === 'PENDING' ? 'var(--gold)' : undefined }}>
                {w.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
