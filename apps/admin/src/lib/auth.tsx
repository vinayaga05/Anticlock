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
import type { AdminUser, Permission, Role } from '@anticlock/contracts';
import { apiFetch, setToken, getToken } from './api';

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<{ user: AdminUser }>('/auth/admin/me')
      .then(res => setUser(res.user))
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ user: AdminUser; token: string }>(
      '/auth/admin/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/admin/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissions: Permission[]) =>
      permissions.some(p => user?.permissions.includes(p)),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
    }),
    [user, loading, login, logout, hasPermission, hasAnyPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export type NavItem = {
  href: string;
  label: string;
  permission?: Permission;
  anyOf?: Permission[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/media', label: 'Media', permission: 'media.read' },
  { href: '/catalog/trees', label: 'Service trees', permission: 'catalog.read' },
  {
    href: '/catalog/categories',
    label: 'Categories',
    permission: 'catalog.read',
  },
  { href: '/users', label: 'Users & roles', permission: 'users.read' },
  { href: '/audit', label: 'Audit log', permission: 'audit.read' },
  { href: '/providers', label: 'Providers', permission: 'provider.read' },
  { href: '/cms', label: 'CMS', permission: 'cms.read' },
  { href: '/reels', label: 'Reels', permission: 'cms.read' },
  { href: '/commerce', label: 'Commerce', permission: 'orders.manage' },
  { href: '/operations', label: 'Operations', permission: 'bookings.manage' },
  { href: '/community', label: 'Community', permission: 'moderation.act' },
  { href: '/settings', label: 'Settings', permission: 'settings.write' },
];

export function canSeeNav(item: NavItem, roles: Role[], permissions: Permission[]) {
  if (!item.permission && !item.anyOf) return true;
  if (item.permission) return permissions.includes(item.permission);
  if (item.anyOf) return item.anyOf.some(p => permissions.includes(p));
  return Boolean(roles.length);
}
