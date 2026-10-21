'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ProviderApplicationSummary } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

const STATUS_FILTERS = [
  { id: 'all', label: 'All in queue' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'Under review' },
  { id: 'more_info_requested', label: 'More info' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
] as const;

export default function ProviderApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'provider', 'applications'],
    queryFn: () =>
      apiFetch<{ data: ProviderApplicationSummary[] }>(
        '/admin/provider/applications',
      ),
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    if (statusFilter === 'all') return list;
    return list.filter(app => app.status === statusFilter);
  }, [data?.data, statusFilter]);

  return (
    <AdminShell>
      <h1 className="page-title">Provider applications</h1>
      <p className="page-sub">
        When an applicant taps Send for review, the application appears here as
        submitted. Approve, reject (with a reason), or request more info. Drafts
        stay private until they submit.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter.id}
            type="button"
            className={statusFilter === filter.id ? 'btn' : 'btn secondary'}
            onClick={() => setStatusFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data && rows.length === 0 ? (
          <p className="muted">
            No applications in this view yet. Submitted businesses from the
            mobile app show up here automatically.
          </p>
        ) : null}
        {data && rows.length > 0 ? (
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
              {rows.map(app => (
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
                  <td>
                    {app.submittedAt
                      ? new Date(app.submittedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>
                    <Link
                      href={`/provider/applications/${app.id}`}
                      className="btn secondary"
                    >
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
