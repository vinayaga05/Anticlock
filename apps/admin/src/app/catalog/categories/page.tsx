'use client';

import { useQuery } from '@tanstack/react-query';
import type { ServiceCategory } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function CategoriesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () =>
      apiFetch<{ data: ServiceCategory[] }>('/admin/catalog/categories'),
  });

  return (
    <AdminShell>
      <h1 className="page-title">Categories</h1>
      <p className="page-sub">Seeded service categories across all trees.</p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tree</th>
                <th>Status</th>
                <th>Order</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map(cat => (
                <tr key={cat.id}>
                  <td>{cat.name}</td>
                  <td>{cat.treeId}</td>
                  <td>
                    <span className="badge">{cat.status}</span>
                  </td>
                  <td>{cat.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </AdminShell>
  );
}
