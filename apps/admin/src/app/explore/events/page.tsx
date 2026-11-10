'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExploreEvent, ExploreReviewRequest } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FILTERS = ['pending_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'archived'] as const;
type Action = ExploreReviewRequest['action'];

function actionsFor(status: string): Action[] {
  if (status === 'pending_review') return ['approve', 'request_changes', 'reject'];
  if (status === 'approved') return ['suspend', 'archive'];
  if (status === 'suspended') return ['restore', 'archive'];
  return [];
}

export default function EventReviewPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');
  const [selected, setSelected] = useState<ExploreEvent | null>(null);
  const [action, setAction] = useState<Action>('approve');
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'explore', 'events', status],
    queryFn: () => apiFetch<{ events: ExploreEvent[] }>(`/admin/explore/events?status=${status}&limit=100`),
  });
  const review = useMutation({
    mutationFn: (input: { id: string; body: ExploreReviewRequest }) => apiFetch(`/admin/explore/events/${input.id}/review`, {
      method: 'POST', body: JSON.stringify(input.body),
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'explore', 'events'] });
      setSelected(null); setReason('');
    },
  });
  const open = (event: ExploreEvent) => {
    const first = actionsFor(event.reviewStatus)[0];
    if (!first) return;
    setSelected(event); setAction(first); setReason('');
  };
  const needsReason = ['request_changes', 'reject', 'suspend'].includes(action);

  return (
    <AdminShell>
      <h1 className="page-title">Event review</h1>
      <p className="page-sub">Review mobile submissions. Approval publishes public events immediately; every action is audited and notifies the creator.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map(item => <button key={item} type="button" className={status === item ? 'btn' : 'btn secondary'} onClick={() => setStatus(item)}>{item.replaceAll('_', ' ')}</button>)}
      </div>
      <div className="card">
        {query.isLoading ? <p className="muted">Loading events…</p> : null}
        {query.error ? <p className="error">{(query.error as Error).message}</p> : null}
        {query.data?.events.length === 0 ? <p className="muted">No events in this queue.</p> : null}
        {query.data?.events.length ? <table className="table"><thead><tr><th>Event</th><th>Creator</th><th>Starts</th><th>Visibility</th><th>Capacity</th><th /></tr></thead><tbody>
          {query.data.events.map(event => <tr key={event.id}>
            <td><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{event.media[0]?.url ? <img src={event.media[0].url} alt="" style={{ width: 56, height: 48, borderRadius: 8, objectFit: 'cover' }} /> : null}<div><strong>{event.title}</strong><div className="muted">{event.categoryId}</div></div></div></td>
            <td>{event.publisher.displayName}</td><td>{new Date(event.startsAt).toLocaleString()}</td><td>{event.requestedVisibility.replaceAll('_', ' ')}</td><td>{event.capacity}</td>
            <td>{hasPermission('moderation.act') && actionsFor(event.reviewStatus).length ? <button type="button" className="btn secondary small" onClick={() => open(event)}>Review</button> : null}</td>
          </tr>)}
        </tbody></table> : null}
      </div>
      {selected ? <div className="modal-overlay" onClick={() => setSelected(null)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Review {selected.title}</h2>
        <div className="form-group"><label htmlFor="action">Action</label><select id="action" className="form-input" value={action} onChange={e => setAction(e.target.value as Action)}>{actionsFor(selected.reviewStatus).map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></div>
        <div className="form-group"><label htmlFor="reason">Reason {needsReason ? '(required)' : '(optional)'}</label><textarea id="reason" className="form-input" rows={4} value={reason} onChange={e => setReason(e.target.value)} /></div>
        {review.error ? <p className="error">{(review.error as Error).message}</p> : null}
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="btn primary" disabled={review.isPending || (needsReason && !reason.trim())} onClick={() => review.mutate({ id: selected.id, body: { action, ...(reason.trim() ? { reason: reason.trim() } : {}) } })}>{review.isPending ? 'Saving…' : 'Confirm'}</button></div>
      </div></div> : null}
    </AdminShell>
  );
}
