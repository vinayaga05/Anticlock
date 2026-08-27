'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaAsset, StubBanner } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { MediaPicker } from '@/components/media/MediaPicker';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CmsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'stubs', 'banners'],
    queryFn: () => apiFetch<{ data: StubBanner[] }>('/admin/stubs/banners'),
  });

  const setHero = useMutation({
    mutationFn: (input: { bannerId: string; mediaId: string }) =>
      apiFetch(`/admin/stubs/banners/${input.bannerId}/hero-media`, {
        method: 'PUT',
        body: JSON.stringify({ mediaId: input.mediaId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stubs', 'banners'] });
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
  });

  function onSelect(asset: MediaAsset) {
    if (!pickerFor) return;
    setHero.mutate({ bannerId: pickerFor, mediaId: asset.id });
    setPickerFor(null);
  }

  return (
    <AdminShell>
      <h1 className="page-title">CMS · Banners</h1>
      <p className="page-sub">
        Stub banners — set a hero image from the Media Library.
      </p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data?.data.map(b => (
          <div
            key={b.id}
            style={{
              padding: '14px 0',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div className="toolbar">
              <div>
                <strong>{b.title}</strong>
                <div className="muted">
                  {b.id} · {b.status}
                </div>
              </div>
              {hasPermission('cms.write') && hasPermission('media.write') ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPickerFor(b.id)}
                >
                  Set hero image
                </button>
              ) : null}
            </div>
            {b.heroDeliveryUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="hero-preview" src={b.heroDeliveryUrl} alt="" />
            ) : (
              <p className="muted">No hero image</p>
            )}
          </div>
        ))}
      </div>
      <MediaPicker
        open={Boolean(pickerFor)}
        onClose={() => setPickerFor(null)}
        onSelect={onSelect}
        kind="image"
      />
      {setHero.isError ? (
        <p className="error">{(setHero.error as Error).message}</p>
      ) : null}
    </AdminShell>
  );
}
