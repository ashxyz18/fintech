import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; text: string; type: ToastType }

interface ToastApi {
  toast: (text: string, type?: ToastType) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, text, type }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack">
        {items.map(t => (
          <div key={t.id} className={`toast show ${t.type}`}>
            <i className={`fa-solid ${t.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>{' '}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Fallback to console if used outside provider — should never happen in app
    return { toast: (m, type) => console.log(`[toast:${type ?? 'info'}]`, m) };
  }
  return ctx;
}

/* Helper: react to <Navigate /> redirects after auth action. */
export function useNoop() { useEffect(() => undefined, []); }
