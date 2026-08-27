'use client';

import { AdminShell } from '@/components/AdminShell';
import { useAuth } from '@/lib/auth';

export default function OverviewPage() {
  const { user } = useAuth();

  return (
    <AdminShell>
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">
        Phase 1 foundation — auth, RBAC, audit, and read-only catalog.
      </p>
      <div className="card">
        <p>
          Signed in as <strong>{user?.name}</strong> ({user?.email})
        </p>
        <p className="muted">Roles</p>
        <div>
          {user?.roles.map(r => (
            <span key={r} className="badge">
              {r}
            </span>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
