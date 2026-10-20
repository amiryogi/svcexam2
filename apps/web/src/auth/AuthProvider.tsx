import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '@svi/shared';
import { api, ApiError, setCsrfToken, setUnauthorizedHandler } from '../api/client';

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
      qc.setQueryData(ME_KEY, r.user);
    },
    [qc],
  );

  // Signs out on this device even when the request fails (firewall block, session already gone):
  // the server session then simply expires.
  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // nothing to do: the local sign-out below is what the user asked for
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
