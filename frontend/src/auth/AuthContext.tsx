import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  clearSession,
  getRefreshToken,
  getStoredToken,
  logoutRequest,
  refreshSession,
  setRefreshToken,
  setStoredToken,
} from '../api/http';

export type RoleCode = 'ADMIN' | 'COLLABORATOR';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: RoleCode;
  mustChangePassword: boolean;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  bootstrapped: boolean;
  /** Incrementar tras acreditación de jikkopuntos para refrescar vistas de saldo. */
  jikkopointsTick: number;
  bumpJikkopoints: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [jikkopointsTick, setJikkopointsTick] = useState(0);

  const bumpJikkopoints = useCallback(() => {
    setJikkopointsTick((n) => n + 1);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await api<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: { code: RoleCode };
      mustChangePassword: boolean;
    }>('/auth/me');
    setUser({
      id: me.id,
      email: me.email,
      firstName: me.firstName,
      lastName: me.lastName,
      roleCode: me.role.code,
      mustChangePassword: me.mustChangePassword,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = getStoredToken();
      const hasRefresh = !!getRefreshToken();
      if (!access && !hasRefresh) {
        if (!cancelled) {
          setBootstrapped(true);
        }
        return;
      }
      try {
        if (!access && hasRefresh) {
          const ok = await refreshSession();
          if (!ok) {
            clearSession();
            if (!cancelled) {
              setBootstrapped(true);
            }
            return;
          }
        }
        await refreshMe();
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      bootstrapped,
      jikkopointsTick,
      bumpJikkopoints,
      login,
      logout,
      refreshMe,
    }),
    [
      user,
      loading,
      bootstrapped,
      jikkopointsTick,
      bumpJikkopoints,
      login,
      logout,
      refreshMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth fuera de AuthProvider');
  }
  return ctx;
}
