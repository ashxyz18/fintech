import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useAccount } from '../lib/useAccount';
import { useToast } from '../components/Toast';
import { resetAccount } from '../lib/auth';
import { fmtMoney } from '../lib/format';

export function Account() {
  const { user, signOut } = useAuth();
  const [account] = useAccount();
  const { toast } = useToast();
  const nav = useNavigate();

  if (!user) return null;

  function reset() {
    if (!confirm('Reset demo account to seeded state? This clears trade history and resets wallets.')) return;
    resetAccount();
    toast('Demo account reset.');
    location.reload();
  }
  function out() {
    signOut();
    toast('Signed out.');
    nav('/');
  }

  return (
    <div className="app-section">
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <div className="sub">Manage your profile and preferences.</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h3 className="mb-md">Profile</h3>
          <div className="form-group">
            <label>Name</label>
            <input defaultValue={user.name ?? ''} placeholder="Your name" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input defaultValue={user.email} disabled />
          </div>
          <div className="form-group">
            <label>Member since</label>
            <input defaultValue={new Date(user.createdAt).toLocaleDateString()} disabled />
          </div>
          <button className="btn btn-primary" onClick={() => toast('Profile saved.')}>
            <i className="fa-solid fa-check" /> Save changes
          </button>
        </div>

        <div className="card">
          <h3 className="mb-md">Account summary</h3>
          <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="kpi"><div className="label">Total balance</div><div className="value">{fmtMoney(account.balance)}</div></div>
            <div className="kpi"><div className="label">Main wallet</div><div className="value">{fmtMoney(account.wallets.main.balance)}</div></div>
            <div className="kpi"><div className="label">Trading wallet</div><div className="value">{fmtMoney(account.wallets.trading.balance)}</div></div>
            <div className="kpi"><div className="label">All-time PnL</div><div className="value text-green">+{fmtMoney(account.pnlAllTime)}</div></div>
            <div className="kpi"><div className="label">Trades</div><div className="value">{account.trades.length}</div></div>
            <div className="kpi"><div className="label">Win rate</div><div className="value">{account.winRate}%</div></div>
          </div>

          <h4 className="mt-lg mb-md">Danger zone</h4>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={reset}>
              <i className="fa-solid fa-rotate-left" /> Reset demo data
            </button>
            <button className="btn btn-danger" onClick={out}>
              <i className="fa-solid fa-arrow-right-from-bracket" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
