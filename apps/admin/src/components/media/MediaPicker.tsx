'use client';

import { useQuery } from '@tanstack/react-query';
import type { MediaAsset } from '@anticlock/contracts';
import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatBytes, formatDuration } from '@/lib/mediaUpload';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  kind?: 'image' | 'document' | 'video';
  multiple?: boolean;
  selectedIds?: string[];
  onConfirm?: () => void;
  confirmLabel?: string;
};

export function MediaPicker({
  open,
  onClose,
  onSelect,
  kind = 'image',
  multiple = false,
  selectedIds = [],
  onConfirm,
  confirmLabel = 'Done',
}: Props) {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'media', 'picker', kind, q],
    enabled: open,
    queryFn: () => {
      const params = new URLSearchParams({
        kind,
        status: 'ready',
        limit: '60',
      });
      // A Reel is public only after an explicit publish action, but its media
      // must already have a public delivery route when it is published.
      if (kind === 'video') params.set('accessLevel', 'public');
      if (q) params.set('q', q);
      return apiFetch<{ data: MediaAsset[] }>(`/admin/media?${params}`);
    },
  });

  const items = useMemo(() => data?.data ?? [], [data]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 720 }}>
        <div className="toolbar">
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Select media</h2>
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <input
            placeholder="Search library…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        {isLoading ? <p className="muted">Loading…</p> : null}
        <div
          className="media-grid"
          style={{ maxHeight: 420, overflow: 'auto' }}
        >
          {items.map(asset => {
            const selected = selectedIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                className={`media-card${selected ? ' selected' : ''}`}
                onClick={() => {
                  onSelect(asset);
                  if (!multiple) onClose();
                }}
              >
                <div className="media-thumb">
                  {asset.kind === 'image' && asset.deliveryUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.deliveryUrl} alt="" />
                  ) : asset.kind === 'video' && asset.deliveryUrl ? (
                    <video
                      src={asset.deliveryUrl}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <span className="muted">
                      {asset.kind === 'video' ? 'MP4' : 'PDF'}
                    </span>
                  )}
                </div>
                <div className="media-meta">
                  <strong>
                    {asset.originalFilename ?? asset.id.slice(0, 8)}
                  </strong>
                  <span className="muted">
                    {formatBytes(asset.byteSize)}
                    {asset.kind === 'video'
                      ? ` · ${formatDuration(asset.durationMs)}`
                      : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {multiple && onConfirm ? (
          <div className="toolbar" style={{ marginTop: 14 }}>
            <span className="muted">{selectedIds.length} selected</span>
            <button type="button" className="btn" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
