'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaAsset, StubProvider } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { MediaPicker } from '@/components/media/MediaPicker';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProvidersPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'stubs', 'providers'],
    queryFn: () => apiFetch<{ data: StubProvider[] }>('/admin/stubs/providers'),
  });

  const setProfile = useMutation({
    mutationFn: (input: { providerId: string; mediaId: string }) =>
      apiFetch(`/admin/stubs/providers/${input.providerId}/profile-media`, {
        method: 'PUT',
        body: JSON.stringify({ mediaId: input.mediaId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'stubs', 'providers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    },
  });

  function onSelect(asset: MediaAsset) {
    if (!pickerFor) return;
    setProfile.mutate({ providerId: pickerFor, mediaId: asset.id });
    setPickerFor(null);
  }

  return (
    <AdminShell>
      <h1 className="page-title">Providers</h1>
      <p className="page-sub">
        Stub list — set a profile image from the Media Library.
      </p>
      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Name</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map(p => (
                <tr key={p.id}>
                  <td>
                    {p.profileDeliveryUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="avatar-preview"
                        src={p.profileDeliveryUrl}
                        alt=""
                      />
                    ) : (
                      <div className="avatar-preview" />
                    )}
                  </td>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.id}</div>
                  </td>
                  <td>
                    <span className="badge">{p.status}</span>
                  </td>
                  <td>
                    {hasPermission('provider.write') &&
                    hasPermission('media.write') ? (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => setPickerFor(p.id)}
                      >
                        Set profile image
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {setProfile.isError ? (
          <p className="error">{(setProfile.error as Error).message}</p>
        ) : null}
      </div>
      <MediaPicker
        open={Boolean(pickerFor)}
        onClose={() => setPickerFor(null)}
        onSelect={onSelect}
        kind="image"
      />
    </AdminShell>
  );
}
