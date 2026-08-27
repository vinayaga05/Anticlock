'use client';

import { useQuery } from '@tanstack/react-query';
import type { ServiceTree } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function TreesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trees'],
    queryFn: () =>
      apiFetch<{ data: ServiceTree[] }>('/admin/catalog/trees'),
  });

  return (
    <AdminShell>
      <h1 className="page-title">Service trees</h1>
      <p className="page-sub">Read-only view of seeded catalog trees (Phase 2 adds CRUD).</p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(tree => (
                <tr key={tree.id}>
                  <td>
                    <strong>{tree.name}</strong>
                    {tree.description ? (
                      <div className="muted">{tree.description}</div>
                    ) : null}
                  </td>
                  <td>{tree.slug}</td>
                  <td>
                    <span className="badge">{tree.status}</span>
                  </td>
                  <td>{tree.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </AdminShell>
  );
}
