'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function AuditPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => apiFetch<{ data: AuditLog[] }>('/admin/audit-logs'),
  });

  return (
    <AdminShell>
      <h1 className="page-title">Audit log</h1>
      <p className="page-sub">Recent admin actions (login, role changes, …).</p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(row => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.actorEmail ?? row.actorId ?? '—'}</td>
                  <td>{row.action}</td>
                  <td>
                    {row.entityType ?? '—'}
                    {row.entityId ? ` · ${row.entityId}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </AdminShell>
  );
}
