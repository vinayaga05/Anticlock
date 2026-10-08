'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type {
  ProviderApplicationAdminDetail,
  ProviderApplicationReviewAction,
} from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function FieldGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="muted">No data</p>;
  return (
    <dl className="detail-grid">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProviderApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [notes, setNotes] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'provider', 'applications', params.id],
    queryFn: () =>
      apiFetch<{ application: ProviderApplicationAdminDetail }>(
        `/admin/provider/applications/${params.id}`,
      ),
  });

  const review = useMutation({
    mutationFn: (body: {
      action: ProviderApplicationReviewAction;
      notes?: string;
      infoRequestMessage?: string;
    }) =>
      apiFetch(`/admin/provider/applications/${params.id}/review`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'provider', 'applications'] });
      qc.invalidateQueries({
        queryKey: ['admin', 'provider', 'applications', params.id],
      });
    },
  });

  const app = data?.application;
  // Only transitions the API will accept for the current status are offered.
  const allowed = new Set(app?.allowedActions ?? []);
  const readiness = app?.readiness;

  return (
    <AdminShell>
      <Link href="/provider/applications" className="muted">
        ← Back to queue
      </Link>
      <h1 className="page-title">Application review</h1>
      {isLoading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      {app ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p>
              <strong>{app.applicantName}</strong> · {app.applicantPhone}
            </p>
            <p>
              <strong>{app.businessName}</strong>
            </p>
            <p className="muted">
              {app.providerKind} · {app.status.replace(/_/g, ' ')} ·{' '}
              {(app.categories ?? []).map(c => c.name).join(', ') ||
                app.categoryIds.join(', ')}
            </p>
            {app.infoRequestMessage ? (
              <p className="error">Info requested: {app.infoRequestMessage}</p>
            ) : null}
            {app.reviewNotes ? <p className="muted">Review notes: {app.reviewNotes}</p> : null}
          </div>

          {readiness ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="section-title">
                Completeness: {readiness.completedCount}/{readiness.requiredCount} required
              </h2>
              {readiness.complete ? (
                <p className="muted">All required details and documents are present.</p>
              ) : (
                <ul>
                  {readiness.missing.map(item => (
                    <li key={item.key} className="error">
                      {item.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {(app.mediaPreviews ?? []).some(m => m.url) ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Profile media</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {(app.mediaPreviews ?? [])
                  .filter(m => m.url)
                  .map(m =>
                    m.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={m.mediaId}
                        src={m.url!}
                        alt={m.filename ?? 'Profile media'}
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <a key={m.mediaId} href={m.url!} target="_blank" rel="noreferrer">
                        {m.filename ?? 'Video'}
                      </a>
                    ),
                  )}
              </div>
            </div>
          ) : null}

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 className="section-title">Common details</h2>
            <FieldGrid data={(app.commonPayload ?? {}) as Record<string, unknown>} />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 className="section-title">Service-specific details</h2>
            <FieldGrid data={app.dynamicPayload ?? {}} />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 className="section-title">KYC (restricted)</h2>
            <p>
              <strong>Aadhaar:</strong> {app.aadhaarMasked ?? 'Not provided'}
            </p>
            <ul>
              {app.documents.map(doc => (
                <li key={doc.fieldKey}>
                  {doc.fieldKey}
                  {doc.downloadUrl ? (
                    <>
                      {' · '}
                      <a href={doc.downloadUrl} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {hasPermission('provider.verify') ? (
            <div className="card">
              <h2 className="section-title">Actions</h2>
              {allowed.size === 0 ? (
                <p className="muted">
                  No review action is available while the application is{' '}
                  {app.status.replace(/_/g, ' ')}.
                </p>
              ) : (
                <>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Review notes (required to reject)"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  {allowed.has('request_info') ? (
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Message to applicant (required to request info)"
                      value={infoMessage}
                      onChange={e => setInfoMessage(e.target.value)}
                      style={{ marginTop: 8 }}
                    />
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {allowed.has('mark_under_review') ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={review.isPending}
                        onClick={() => review.mutate({ action: 'mark_under_review', notes })}
                      >
                        Mark under review
                      </button>
                    ) : null}
                    {allowed.has('request_info') ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={review.isPending || !(infoMessage || notes).trim()}
                        onClick={() =>
                          review.mutate({
                            action: 'request_info',
                            notes,
                            infoRequestMessage: infoMessage || notes,
                          })
                        }
                      >
                        Request more info
                      </button>
                    ) : null}
                    {allowed.has('reject') ? (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={review.isPending || !notes.trim()}
                        onClick={() => review.mutate({ action: 'reject', notes })}
                      >
                        Reject
                      </button>
                    ) : null}
                    {allowed.has('approve') ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={review.isPending || readiness?.complete === false}
                        title={
                          readiness?.complete === false
                            ? 'The application is incomplete'
                            : undefined
                        }
                        onClick={() => review.mutate({ action: 'approve', notes })}
                      >
                        Approve
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              {review.isError ? (
                <p className="error">{(review.error as Error).message}</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}
