import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { PayoutBar } from './PayoutBar';
import { Sidebar } from './Sidebar';

/* Authenticated layout: sidebar + main content area + the live payout bar
   pinned at the top of the content (consistent with the vanilla site). */
export function AppLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <PayoutBar />
        <Outlet />
      </main>
    </div>
  );
}
