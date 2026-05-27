import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../types';
import { getAccount, setAccount } from './auth';

/* Hook that returns the user's Account from localStorage and a setter
   that persists changes immediately. Components can call `update(patch)`
   with a function or a partial to mutate state safely. */
export function useAccount() {
  const [account, setAccountState] = useState<Account>(() => getAccount());

  // Re-sync if another tab/page mutates account state.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'cv_account') setAccountState(getAccount());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<Account> | ((a: Account) => Account)) => {
    setAccountState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      setAccount(next);
      return next;
    });
  }, []);

  return [account, update] as const;
}
