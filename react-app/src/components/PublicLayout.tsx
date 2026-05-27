import { Link, Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link to="/" className="logo" style={{ marginBottom: 14 }}>
              <span className="logo-mark">CV</span>
              <span>CryptoVault</span>
            </Link>
            <p className="text-dim" style={{ fontSize: '0.9rem', maxWidth: 340 }}>
              AI-powered crypto investing for everyone. Regulated, audited, and trusted by 180k+ investors worldwide.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li><Link to="/markets">Markets</Link></li>
              <li><Link to="/trading">AI Bots</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/deposit">Deposit</Link></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">How it works</Link></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Press</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Risk disclosure</a></li>
              <li><a href="#">Licenses</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 CryptoVault Labs Inc. — Investing in crypto involves risk.</span>
          <span>Built with <i className="fa-solid fa-heart text-red"></i> in NYC</span>
        </div>
      </div>
    </footer>
  );
}
