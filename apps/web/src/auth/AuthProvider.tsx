import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminAuthApi, authApi, type Account, type AdminAccount, type RegistrationDetails } from '../types/auth';

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  adminAccount: AdminAccount | null;
  adminLoading: boolean;
  login: (email: string, password: string) => Promise<Account>;
  register: (details: RegistrationDetails) => Promise<void>;
  logout: () => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<AdminAccount>;
  adminLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    authApi
      .current()
      .then(({ user }) => setAccount(user))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
    adminAuthApi
      .current()
      .then(({ admin }) => setAdminAccount(admin))
      .catch(() => setAdminAccount(null))
      .finally(() => setAdminLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setAccount(result.user);
    return result.user;
  }, []);
  const register = useCallback(async (details: RegistrationDetails) => {
    const result = await authApi.register(details);
    setAccount(result.user);
  }, []);
  const logout = useCallback(async () => {
    await authApi.logout();
    setAccount(null);
  }, []);
  const adminLogin = useCallback(async (email: string, password: string) => {
    const result = await adminAuthApi.login(email, password);
    setAdminAccount(result.admin);
    return result.admin;
  }, []);
  const adminLogout = useCallback(async () => {
    await adminAuthApi.logout();
    setAdminAccount(null);
  }, []);

  const value = useMemo(
    () => ({ account, loading, adminAccount, adminLoading, login, register, logout, adminLogin, adminLogout }),
    [account, loading, adminAccount, adminLoading, login, register, logout, adminLogin, adminLogout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
