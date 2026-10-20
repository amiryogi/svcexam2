import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '@svi/shared';
import { toast } from 'sonner';
import { api, ApiError, setCsrfToken, setUnauthorizedHandler } from '../api/client';
import { hasPendingLogout, setPendingLogout } from './pendingLogout';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ME_KEY = ['auth', 'me'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const r = await api<LoginResponse>('/auth/me');
        setCsrfToken(r.csrfToken);
        if (hasPendingLogout()) {
          // An earlier sign-out never reached the server: finish it, and never restore the session.
          await finishLogout().catch(() => undefined);
          setCsrfToken(null);
          return null;
        }
        return r.user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const signedOut = useCallback(() => {
    setCsrfToken(null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    qc.setQueryData(ME_KEY, null);
  }, [qc]);

  useEffect(() => setUnauthorizedHandler(signedOut), [signedOut]);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await api<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } });
      setCsrfToken(r.csrfToken);
      setPendingLogout(false);
      qc.setQueryData(ME_KEY, r.user);
    },
    [qc],
  );

  // Signs out on this device even when the request fails. If it didn't reach the server (firewall
  // block, network), the server session is still valid: remember that, so the next start finishes the
  // sign-out instead of signing this user back in.
  const logout = useCallback(async () => {
    try {
      await finishLogout();
    } catch {
      setPendingLogout(true);
      toast.warning('Signed out on this computer, but the server could not be reached. The sign-out will be completed the next time this app is opened.');
    } finally {
      signedOut();
    }
  }, [signedOut]);

  const value = useMemo(
    () => ({ user: me.data ?? null, loading: me.isPending, login, logout }),
    [me.data, me.isPending, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Ends the server session. A 401 means it has already ended, which counts as done. */
async function finishLogout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) throw e;
  }
  setPendingLogout(false);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
