'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ProviderFormSchema } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function ProviderFormSchemasPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'provider', 'form-schemas'],
    queryFn: () =>
      apiFetch<{ data: ProviderFormSchema[] }>('/admin/provider/form-schemas'),
  });

  return (
    <AdminShell>
      <h1 className="page-title">Provider form schemas</h1>
      <p className="page-sub">
        Configure dynamic onboarding fields per service category. Mobile apps render
        these schemas without a release.
      </p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Category</th>
                <th>Kinds</th>
                <th>Fields</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map(schema => (
                <tr key={schema.id}>
                  <td>
                    <span className="badge">{schema.scope}</span>
                  </td>
                  <td>{schema.categoryId ?? '—'}</td>
                  <td>{schema.providerKinds.join(', ')}</td>
                  <td>{schema.fields.length}</td>
                  <td>
                    <Link href={`/provider/form-schemas/${schema.id}`} className="btn secondary">
                      Edit
                    </Link>
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
