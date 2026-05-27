import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './components/charts'; // Side-effect: registers Chart.js components
import { AnimatedBackdrop } from './components/AnimatedBackdrop';
import { AppLayout } from './components/AppLayout';
import { PublicLayout } from './components/PublicLayout';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './lib/AuthContext';
import { About } from './pages/About';
import { Account } from './pages/Account';
import { Dashboard } from './pages/Dashboard';
import { Deposit } from './pages/Deposit';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Markets } from './pages/Markets';
import { Signup } from './pages/Signup';
import { Trading } from './pages/Trading';
import { Withdraw } from './pages/Withdraw';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AnimatedBackdrop />
        <BrowserRouter>
          <Routes>
            {/* Public marketing layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>

            {/* Authenticated app layout (sidebar + payout bar) */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/markets"   element={<Markets />} />
              <Route path="/trading"   element={<Trading />} />
              <Route path="/deposit"   element={<Deposit />} />
              <Route path="/withdraw"  element={<Withdraw />} />
              <Route path="/account"   element={<Account />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
