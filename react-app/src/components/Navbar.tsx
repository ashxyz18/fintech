import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="nav-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">CV</span>
          <span>CryptoVault</span>
        </Link>

        <ul className={`nav-links${open ? ' open' : ''}`}>
          <li><NavLink to="/" end onClick={() => setOpen(false)}>Home</NavLink></li>
          <li><NavLink to="/markets" onClick={() => setOpen(false)}>Markets</NavLink></li>
          <li><NavLink to="/trading" onClick={() => setOpen(false)}>AI Trading</NavLink></li>
          <li><NavLink to="/about" onClick={() => setOpen(false)}>How it works</NavLink></li>
          <li><NavLink to="/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink></li>
        </ul>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/account" className="btn btn-ghost btn-sm">Account</Link>
              <Link to="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
          <button
            className="menu-toggle"
            aria-label="Menu"
            onClick={() => setOpen(o => !o)}
          >
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
