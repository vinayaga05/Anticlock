'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaAsset, StubProduct } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { MediaPicker } from '@/components/media/MediaPicker';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CommercePage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'stubs', 'products'],
    queryFn: () => apiFetch<{ data: StubProduct[] }>('/admin/stubs/products'),
  });

  const saveGallery = useMutation({
    mutationFn: (input: { productId: string; mediaIds: string[] }) =>
      apiFetch(`/admin/stubs/products/${input.productId}/gallery`, {
        method: 'PUT',
        body: JSON.stringify({ mediaIds: input.mediaIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stubs', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
      setPickerFor(null);
    },
  });

  function openPicker(product: StubProduct) {
    setDraftIds(product.gallery?.map(g => g.mediaId) ?? []);
    setPickerFor(product.id);
  }

  function onSelect(asset: MediaAsset) {
    setDraftIds(prev =>
      prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id],
    );
  }

  return (
    <AdminShell>
      <h1 className="page-title">Commerce</h1>
      <p className="page-sub">
        Stub products — attach a gallery from the Media Library.
      </p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data?.data.map(p => (
          <div
            key={p.id}
            style={{
              padding: '14px 0',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div className="toolbar">
              <div>
                <strong>{p.name}</strong>
                <div className="muted">
                  {p.id} · {p.status}
                </div>
              </div>
              {hasPermission('orders.manage') && hasPermission('media.write') ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => openPicker(p)}
                >
                  Edit gallery
                </button>
              ) : null}
            </div>
            <div className="gallery-row">
              {(p.gallery ?? []).map(g =>
                g.deliveryUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g.mediaId} src={g.deliveryUrl} alt="" />
                ) : null,
              )}
              {(p.gallery ?? []).length === 0 ? (
                <span className="muted">No gallery images</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <MediaPicker
        open={Boolean(pickerFor)}
        onClose={() => setPickerFor(null)}
        onSelect={onSelect}
        kind="image"
        multiple
        selectedIds={draftIds}
        confirmLabel="Save gallery"
        onConfirm={() => {
          if (!pickerFor) return;
          saveGallery.mutate({ productId: pickerFor, mediaIds: draftIds });
        }}
      />
      {saveGallery.isError ? (
        <p className="error">{(saveGallery.error as Error).message}</p>
      ) : null}
    </AdminShell>
  );
}
