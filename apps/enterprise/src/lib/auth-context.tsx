'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { fetchUserProfile } from '@/lib/auth/profile';
import { DEMO_PASSWORD, MOCK_USERS } from '@/lib/mock-data';
import { MOCK_COMPANIES } from '@/lib/mock-companies';
import { createBrowserClient } from '@/lib/supabase/client';
import { allowsDemoAuth, isSupabaseConfigured } from '@/lib/env';
import {
  ACTIVE_TENANT_KEY,
  DEMO_COMPANY_ID,
  DEMO_COMPANY_NAME,
} from '@/lib/tenant/constants';
import {
  isSuperAdmin,
  resolveEffectiveCompanyId,
  resolveEffectiveCompanyName,
} from '@/lib/tenant/filter';
import { apiFetch } from '@/lib/api/client';
import type { Company, SessionUser, TokenPass, User } from '@/types';

function postAudit(user: SessionUser, body: Record<string, unknown>) {
  void apiFetch(user, '/api/audit', {
    method: 'POST',
    body: JSON.stringify(body),
  }).catch(() => {});
}

const SESSION_KEY = 'sort-gateway-enterprise-session';
const TOKEN_PASS_KEY = 'sort-gateway-active-token-pass';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isSupabaseAuth: boolean;
  activeTokenPass: TokenPass | null;
  effectiveCompanyId: string;
  effectiveCompanyName: string;
  availableCompanies: Company[];
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  applyTokenPass: (code: string) => Promise<{ ok: boolean; error?: string }>;
  clearTokenPass: () => void;
  setActiveTenant: (companyId: string, companyName: string) => void;
  clearActiveTenant: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function companyNameFor(id: string): string {
  return MOCK_COMPANIES.find((c) => c.id === id)?.name ?? DEMO_COMPANY_NAME;
}

function toSessionUser(u: User): SessionUser {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    display_name: u.full_name,
    role: u.role,
    company_id: u.company_id,
    company_name: companyNameFor(u.company_id),
    department_id: u.department_id,
    department_name: u.department_name,
  };
}

function loadTenantOverride(): { id: string; name: string } | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_TENANT_KEY);
    return raw ? (JSON.parse(raw) as { id: string; name: string }) : null;
  } catch {
    return null;
  }
}

function applyTenantOverride(user: SessionUser): SessionUser {
  const override = loadTenantOverride();
  if (!override || !isSuperAdmin(user.role)) return user;
  return {
    ...user,
    tenant_company_id: override.id,
    tenant_company_name: override.name,
  };
}

function loadTokenPassFromStorage(): TokenPass | null {
  try {
    const tp = sessionStorage.getItem(TOKEN_PASS_KEY);
    return tp ? (JSON.parse(tp) as TokenPass) : null;
  } catch {
    sessionStorage.removeItem(TOKEN_PASS_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTokenPass, setActiveTokenPass] = useState<TokenPass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const supabaseAuth = isSupabaseConfigured();

  useEffect(() => {
    if (user?.role === 'super_admin') {
      apiFetch(user, '/api/companies')
        .then((r) => r.json())
        .then((data) => {
          if (data.companies) setAvailableCompanies(data.companies);
        })
        .catch(() => setAvailableCompanies(MOCK_COMPANIES));
    }
  }, [user]);

  useEffect(() => {
    setActiveTokenPass(loadTokenPassFromStorage());

    if (!supabaseAuth) {
      if (allowsDemoAuth()) {
        try {
          const raw = sessionStorage.getItem(SESSION_KEY);
          if (raw) {
            const parsed = applyTenantOverride(JSON.parse(raw) as SessionUser);
            setUser(parsed);
          }
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      setIsLoading(false);
      return;
    }

    const client = createBrowserClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const syncSession = async () => {
      const { data } = await client.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        const profile = applyTenantOverride(
          await fetchUserProfile(client, data.session.user.id, data.session.user.email)
        );
        if (mounted) setUser(profile);
      } else {
        setUser(null);
      }
      if (mounted) setIsLoading(false);
    };

    syncSession();

    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        const profile = applyTenantOverride(
          await fetchUserProfile(client, session.user.id, session.user.email)
        );
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabaseAuth]);

  const persistUser = useCallback((next: SessionUser) => {
    setUser(next);
    if (allowsDemoAuth()) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      if (supabaseAuth) {
        const client = createBrowserClient();
        if (!client) {
          return { ok: false, error: 'Supabase クライアントを初期化できません' };
        }
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          return { ok: false, error: 'メールアドレスまたはパスワードが正しくありません' };
        }
        let profile = await fetchUserProfile(client, data.user.id, data.user.email);
        if (isSuperAdmin(profile.role)) {
          profile = {
            ...profile,
            tenant_company_id: DEMO_COMPANY_ID,
            tenant_company_name: DEMO_COMPANY_NAME,
          };
          sessionStorage.setItem(
            ACTIVE_TENANT_KEY,
            JSON.stringify({ id: DEMO_COMPANY_ID, name: DEMO_COMPANY_NAME })
          );
        }
        setUser(profile);
        postAudit(profile, { action: 'auth.login', resourceType: 'session', result: 'success' });
        return { ok: true };
      }

      if (!allowsDemoAuth()) {
        return {
          ok: false,
          error: isSupabaseConfigured()
            ? 'Supabase クライアントを初期化できません'
            : '本番環境ではデモログインは無効です。Supabase Auth でサインインしてください。',
        };
      }

      const found = MOCK_USERS.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.is_active
      );
      if (!found || password !== DEMO_PASSWORD) {
        return { ok: false, error: 'メールアドレスまたはパスワードが正しくありません' };
      }
      let session = toSessionUser(found);
      if (isSuperAdmin(session.role)) {
        session = {
          ...session,
          tenant_company_id: DEMO_COMPANY_ID,
          tenant_company_name: DEMO_COMPANY_NAME,
        };
        sessionStorage.setItem(
          ACTIVE_TENANT_KEY,
          JSON.stringify({ id: DEMO_COMPANY_ID, name: DEMO_COMPANY_NAME })
        );
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      postAudit(session, { action: 'auth.login', resourceType: 'session', result: 'success' });
      return { ok: true };
    },
    [supabaseAuth]
  );

  const logout = useCallback(() => {
    const run = async () => {
      if (user) {
        postAudit(user, { action: 'auth.logout', resourceType: 'session' });
      }
      if (supabaseAuth) {
        const client = createBrowserClient();
        if (client) await client.auth.signOut();
      }
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TOKEN_PASS_KEY);
      sessionStorage.removeItem(ACTIVE_TENANT_KEY);
      setUser(null);
      setActiveTokenPass(null);
      router.push('/login');
    };
    void run();
  }, [router, supabaseAuth, user]);

  const setActiveTenant = useCallback(
    (companyId: string, companyName: string) => {
      if (!user || !isSuperAdmin(user.role)) return;
      sessionStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify({ id: companyId, name: companyName }));
      persistUser({
        ...user,
        tenant_company_id: companyId,
        tenant_company_name: companyName,
      });
      postAudit(user, {
        action: 'tenant.switch',
        resourceType: 'company',
        targetCompanyId: companyId,
        targetCompanyName: companyName,
      });
    },
    [user, persistUser]
  );

  const clearActiveTenant = useCallback(() => {
    if (!user || !isSuperAdmin(user.role)) return;
    sessionStorage.removeItem(ACTIVE_TENANT_KEY);
    persistUser({
      ...user,
      tenant_company_id: null,
      tenant_company_name: null,
    });
  }, [user, persistUser]);

  const applyTokenPass = useCallback(
    async (code: string) => {
      if (!user) return { ok: false, error: 'ログインが必要です' };
      try {
        const res = await apiFetch(user, '/api/token-pass/verify', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!data.ok || !data.pass) {
          return { ok: false, error: data.error || 'トークンパスが無効です' };
        }

        const pass = data.pass as TokenPass;
        sessionStorage.setItem(TOKEN_PASS_KEY, JSON.stringify(pass));
        setActiveTokenPass(pass);
        if (user && allowsDemoAuth()) {
          persistUser({ ...user, active_token_pass_id: pass.id });
        }
        return { ok: true };
      } catch {
        return { ok: false, error: 'トークン検証に失敗しました' };
      }
    },
    [user, persistUser]
  );

  const clearTokenPass = useCallback(() => {
    sessionStorage.removeItem(TOKEN_PASS_KEY);
    setActiveTokenPass(null);
    if (user && allowsDemoAuth()) {
      persistUser({ ...user, active_token_pass_id: null });
    }
  }, [user, persistUser]);

  const effectiveCompanyId = resolveEffectiveCompanyId(user);
  const effectiveCompanyName = resolveEffectiveCompanyName(user);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isSupabaseAuth: supabaseAuth,
      activeTokenPass,
      effectiveCompanyId,
      effectiveCompanyName,
      availableCompanies,
      login,
      logout,
      applyTokenPass,
      clearTokenPass,
      setActiveTenant,
      clearActiveTenant,
    }),
    [
      user,
      isLoading,
      supabaseAuth,
      activeTokenPass,
      effectiveCompanyId,
      effectiveCompanyName,
      availableCompanies,
      login,
      logout,
      applyTokenPass,
      clearTokenPass,
      setActiveTenant,
      clearActiveTenant,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
