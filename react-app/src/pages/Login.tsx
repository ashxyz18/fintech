import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';

export function Login() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return toast('Enter a valid email', 'error');
    if (pw.length < 4) return toast('Password too short (demo only)', 'error');
    setBusy(true);
    setTimeout(() => {
      signIn(email);
      toast('Signed in. Welcome back.');
      nav('/dashboard');
    }, 350);
  }

  return (
    <section className="auth-page">
      <div className="auth-card card glow">
        <div className="text-center mb-md">
          <div className="logo-mark" style={{ width: 56, height: 56, margin: '0 auto 14px', fontSize: '1.3rem' }}>CV</div>
          <h2 style={{ marginBottom: 6 }}>Welcome back</h2>
          <p className="text-dim" style={{ fontSize: '0.92rem' }}>Sign in to your CryptoVault account.</p>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : (<><i className="fa-solid fa-right-to-bracket" /> Sign in</>)}
          </button>
        </form>
        <div className="text-center mt-md text-dim" style={{ fontSize: '0.88rem' }}>
          New here? <Link to="/signup" className="text-blue">Create an account</Link>
        </div>
        <div className="text-mute mt-md text-center" style={{ fontSize: '0.78rem' }}>
          <i className="fa-solid fa-shield" /> Demo account · funds simulated
        </div>
      </div>
    </section>
  );
}
