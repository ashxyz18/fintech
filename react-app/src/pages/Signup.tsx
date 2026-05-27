import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../components/Toast';

export function Signup() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast('Please tell us your name', 'error');
    if (!email.includes('@')) return toast('Enter a valid email', 'error');
    if (pw.length < 6) return toast('Password must be 6+ characters', 'error');
    setBusy(true);
    setTimeout(() => {
      signUp(email, name.trim());
      toast(`Account created — welcome, ${name.split(' ')[0]}!`);
      nav('/dashboard');
    }, 350);
  }

  return (
    <section className="auth-page">
      <div className="auth-card card glow">
        <div className="text-center mb-md">
          <div className="logo-mark" style={{ width: 56, height: 56, margin: '0 auto 14px', fontSize: '1.3rem' }}>CV</div>
          <h2 style={{ marginBottom: 6 }}>Create your account</h2>
          <p className="text-dim" style={{ fontSize: '0.92rem' }}>60-second sign-up. No paperwork. No minimums.</p>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="6+ characters" />
          </div>
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy}>
            {busy ? 'Creating…' : (<><i className="fa-solid fa-rocket" /> Create account</>)}
          </button>
        </form>
        <div className="text-center mt-md text-dim" style={{ fontSize: '0.88rem' }}>
          Already have an account? <Link to="/login" className="text-blue">Sign in</Link>
        </div>
        <div className="text-mute mt-md text-center" style={{ fontSize: '0.78rem' }}>
          By creating an account you agree to our <a href="#" className="text-blue">Terms</a> and{' '}
          <a href="#" className="text-blue">Risk Disclosure</a>.
        </div>
      </div>
    </section>
  );
}
