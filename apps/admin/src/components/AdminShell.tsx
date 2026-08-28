'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { NAV_ITEMS, canSeeNav, useAuth } from '@/lib/auth';

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="placeholder">Loading…</div>;
  }

  const visible = NAV_ITEMS.filter(item =>
    canSeeNav(item, user.roles, user.permissions),
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/brand/logo.png" alt="Anticlock" className="brand-logo" />
          <div>
            Anticlock
            <span>Control center</span>
          </div>
        </div>
        {visible.map(item => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${active ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="sidebar-footer">
          <div>
            {user.name}
            <div className="muted" style={{ color: '#8aa0ae' }}>
              {user.email}
            </div>
          </div>
          <button type="button" className="btn secondary" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
