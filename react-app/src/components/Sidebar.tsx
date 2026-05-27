import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function Sidebar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const initials = (user?.name || user?.email || 'U')
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <aside className="sidebar">
      <Link to="/" className="logo">
        <span className="logo-mark">CV</span>
        <span>CryptoVault</span>
      </Link>

      <nav>
        <NavLink to="/dashboard"><i className="icon fa-solid fa-gauge-high"></i> Dashboard</NavLink>
        <NavLink to="/markets"><i className="icon fa-solid fa-chart-line"></i> Markets</NavLink>
        <NavLink to="/trading"><i className="icon fa-solid fa-robot"></i> AI Trading</NavLink>
        <NavLink to="/deposit"><i className="icon fa-solid fa-arrow-down-to-bracket"></i> Deposit</NavLink>
        <NavLink to="/withdraw"><i className="icon fa-solid fa-arrow-up-from-bracket"></i> Withdraw</NavLink>
        <NavLink to="/account"><i className="icon fa-solid fa-user"></i> Account</NavLink>
        <NavLink to="/about"><i className="icon fa-solid fa-circle-info"></i> How it works</NavLink>
      </nav>

      <div className="sidebar-foot">
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="logo-mark" style={{ width: 34, height: 34, fontSize: '0.85rem' }}>
              {initials || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || user?.email?.split('@')[0] || 'Trader'}
              </div>
              <div className="text-mute" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email ?? '—'}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-block"
            onClick={() => { signOut(); nav('/'); }}
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
