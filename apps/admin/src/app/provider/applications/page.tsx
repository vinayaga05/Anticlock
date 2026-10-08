'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ProviderApplicationSummary } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function ProviderApplicationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'provider', 'applications'],
    queryFn: () =>
      apiFetch<{ data: ProviderApplicationSummary[] }>(
        '/admin/provider/applications',
      ),
  });

  return (
    <AdminShell>
      <h1 className="page-title">Provider applications</h1>
      <p className="page-sub">
        Review onboarding submissions (drafts are private to the applicant). KYC
        documents and Aadhaar are shown only here.
      </p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Kind</th>
                <th>Service</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map(app => (
                <tr key={app.id}>
                  <td>{app.businessName}</td>
                  <td>
                    <span className="badge">{app.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{app.providerKind}</td>
                  <td>
                    {(app.categories ?? []).map(c => c.name).join(', ') ||
                      app.categoryIds.join(', ') ||
                      '—'}
                  </td>
                  <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleString() : '—'}</td>
                  <td>
                    <Link href={`/provider/applications/${app.id}`} className="btn secondary">
                      Review
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
