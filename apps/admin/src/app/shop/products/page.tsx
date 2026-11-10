'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExploreReviewRequest, Product } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FILTERS = ['pending_review', 'changes_requested', 'approved', 'rejected', 'suspended', 'archived'] as const;
type Action = ExploreReviewRequest['action'];
type ReviewProduct = Product & { publisher?: { displayName: string } | null };

function actionsFor(status: string): Action[] {
  if (status === 'pending_review') return ['approve', 'request_changes', 'reject'];
  if (status === 'approved') return ['suspend', 'archive'];
  if (status === 'suspended') return ['restore', 'archive'];
  return [];
}

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');
  const [selected, setSelected] = useState<ReviewProduct | null>(null);
  const [action, setAction] = useState<Action>('approve');
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'shop', 'products', status],
    queryFn: () => apiFetch<{ products: ReviewProduct[] }>(`/admin/shop/products?reviewStatus=${status}&limit=100`),
  });
  const review = useMutation({
    mutationFn: (input: { id: string; body: ExploreReviewRequest }) => apiFetch(`/admin/shop/products/${input.id}/review`, {
      method: 'POST', body: JSON.stringify(input.body),
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] });
      setSelected(null); setReason('');
    },
  });
  const open = (product: ReviewProduct) => {
    const first = actionsFor(product.reviewStatus)[0];
    if (!first) return;
    setSelected(product); setAction(first); setReason('');
  };
  const needsReason = ['request_changes', 'reject', 'suspend'].includes(action);

  return (
    <AdminShell>
      <h1 className="page-title">Product review</h1>
      <p className="page-sub">Review products submitted from the mobile app. Approval updates Explore and search immediately; the creator is notified.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTERS.map(item => <button key={item} type="button" className={status === item ? 'btn' : 'btn secondary'} onClick={() => setStatus(item)}>{item.replaceAll('_', ' ')}</button>)}
      </div>
      <div className="card">
        {query.isLoading ? <p className="muted">Loading products…</p> : null}
        {query.error ? <p className="error">{(query.error as Error).message}</p> : null}
        {query.data?.products.length === 0 ? <p className="muted">No products in this queue.</p> : null}
        {query.data?.products.length ? <table className="table"><thead><tr><th>Product</th><th>Seller</th><th>Price</th><th>Stock</th><th>Visibility</th><th /></tr></thead><tbody>
          {query.data.products.map(product => <tr key={product.id}>
            <td><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{product.images[0]?.url ? <img src={product.images[0].url} alt="" style={{ width: 56, height: 48, borderRadius: 8, objectFit: 'cover' }} /> : null}<div><strong>{product.name}</strong><div className="muted">{product.categoryId}</div></div></div></td>
            <td>{product.publisher?.displayName ?? 'Operator catalog'}</td><td>₹{(product.price / 100).toFixed(2)}</td><td>{product.inventory}</td><td>{product.requestedVisibility.replaceAll('_', ' ')}</td>
            <td>{hasPermission('moderation.act') && product.ownerMobileUserId && actionsFor(product.reviewStatus).length ? <button type="button" className="btn secondary small" onClick={() => open(product)}>Review</button> : null}</td>
          </tr>)}
        </tbody></table> : null}
      </div>
      {selected ? <div className="modal-overlay" onClick={() => setSelected(null)}><div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Review {selected.name}</h2>
        <div className="form-group"><label htmlFor="action">Action</label><select id="action" className="form-input" value={action} onChange={e => setAction(e.target.value as Action)}>{actionsFor(selected.reviewStatus).map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></div>
        <div className="form-group"><label htmlFor="reason">Reason {needsReason ? '(required)' : '(optional)'}</label><textarea id="reason" className="form-input" rows={4} value={reason} onChange={e => setReason(e.target.value)} /></div>
        {review.error ? <p className="error">{(review.error as Error).message}</p> : null}
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="btn primary" disabled={review.isPending || (needsReason && !reason.trim())} onClick={() => review.mutate({ id: selected.id, body: { action, ...(reason.trim() ? { reason: reason.trim() } : {}) } })}>{review.isPending ? 'Saving…' : 'Confirm'}</button></div>
      </div></div> : null}
    </AdminShell>
  );
}
