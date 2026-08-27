'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReelAdmin } from '@anticlock/contracts';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Tab = 'published' | 'draft' | 'sample';

type FormState = {
  title: string;
  caption: string;
  creatorName: string;
  category: string;
  isSample: boolean;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  displayOrder: number;
  externalPlaybackUrl: string;
  externalPosterUrl: string;
  streamUid: string;
};

const emptyForm = (): FormState => ({
  title: '',
  caption: '',
  creatorName: '',
  category: 'Fitness',
  isSample: true,
  likeCount: 0,
  commentCount: 0,
  saveCount: 0,
  displayOrder: 0,
  externalPlaybackUrl: '',
  externalPosterUrl: '',
  streamUid: '',
});

export default function ReelsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canWrite = hasPermission('cms.write');
  const [tab, setTab] = useState<Tab>('draft');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ['admin', 'reels', 'meta'],
    queryFn: () =>
      apiFetch<{ streamConfigured: boolean }>('/admin/reels/meta'),
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'reels', tab],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (tab === 'published') params.set('status', 'published');
      if (tab === 'draft') params.set('status', 'draft');
      if (tab === 'sample') params.set('isSample', 'true');
      return apiFetch<{ data: ReelAdmin[] }>(`/admin/reels?${params}`);
    },
  });

  const reels = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reels'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusyMsg('Creating reel…');
      if (form.streamUid.trim()) {
        return apiFetch<{ data: ReelAdmin }>('/admin/reels/import-stream', {
          method: 'POST',
          body: JSON.stringify({
            streamUid: form.streamUid.trim(),
            title: form.title,
            caption: form.caption || undefined,
            creatorName: form.creatorName,
            category: form.category || undefined,
            isSample: form.isSample,
            likeCount: form.likeCount,
            commentCount: form.commentCount,
            saveCount: form.saveCount,
            displayOrder: form.displayOrder,
          }),
        });
      }
      return apiFetch<{ data: ReelAdmin }>('/admin/reels', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          caption: form.caption || undefined,
          creatorName: form.creatorName,
          category: form.category || undefined,
          isSample: form.isSample,
          likeCount: form.likeCount,
          commentCount: form.commentCount,
          saveCount: form.saveCount,
          displayOrder: form.displayOrder,
          externalPlaybackUrl: form.externalPlaybackUrl || undefined,
          externalPosterUrl: form.externalPosterUrl || undefined,
        }),
      });
    },
    onSuccess: async res => {
      let reel = res.data;
      if (uploadFile && meta.data?.streamConfigured) {
        setBusyMsg('Requesting Stream upload…');
        const session = await apiFetch<{
          uploadUrl: string;
          mediaId: string;
          externalId: string;
        }>(`/admin/reels/${reel.id}/upload-session`, { method: 'POST' });

        setBusyMsg('Uploading video to Cloudflare Stream…');
        const fd = new FormData();
        fd.append('file', uploadFile);
        const up = await fetch(session.uploadUrl, { method: 'POST', body: fd });
        if (!up.ok) {
          throw new Error(`Stream upload failed (${up.status})`);
        }

        setBusyMsg('Syncing processing status…');
        const synced = await apiFetch<{ data: ReelAdmin }>(
          `/admin/reels/${reel.id}/sync-media`,
          { method: 'POST' },
        );
        reel = synced.data;
      }
      setSelectedId(reel.id);
      setShowForm(false);
      setForm(emptyForm());
      setUploadFile(null);
      setBusyMsg(null);
      invalidate();
    },
    onError: (e: Error) => {
      setBusyMsg(null);
      setError(e.message);
    },
  });

  async function runAction(
    path: string,
    method: 'POST' | 'PATCH' = 'POST',
  ) {
    setError(null);
    try {
      await apiFetch(path, { method });
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Reels</h1>
      <p className="page-sub">
        Upload or import sample clips, publish when ready — mobile Clips only
        shows published reels with ready video.
        {meta.data?.streamConfigured
          ? ' Cloudflare Stream is configured.'
          : ' Stream not configured — use a public HTTPS MP4 URL or import a Stream UID after adding credentials.'}
      </p>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="tabs">
          {(
            [
              ['draft', 'Drafts'],
              ['published', 'Published'],
              ['sample', 'Test / Sample'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'btn' : 'btn secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {canWrite ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShowForm(true);
              setForm(emptyForm());
              setUploadFile(null);
              setError(null);
            }}
          >
            + Add Reel
          </button>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {busyMsg ? <p className="muted">{busyMsg}</p> : null}

      {showForm ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>New reel</h2>
          <div className="form-grid">
            <div className="field">
              <label>Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Morning Workout"
              />
            </div>
            <div className="field">
              <label>Creator</label>
              <input
                value={form.creatorName}
                onChange={e =>
                  setForm(f => ({ ...f, creatorName: e.target.value }))
                }
                placeholder="Ravi Kumar"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Caption</label>
              <textarea
                rows={3}
                value={form.caption}
                onChange={e =>
                  setForm(f => ({ ...f, caption: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                value={form.category}
                onChange={e =>
                  setForm(f => ({ ...f, category: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Display order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    displayOrder: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Like seed</label>
              <input
                type="number"
                value={form.likeCount}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    likeCount: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Comment seed</label>
              <input
                type="number"
                value={form.commentCount}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    commentCount: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Save seed</label>
              <input
                type="number"
                value={form.saveCount}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    saveCount: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="field" style={{ alignContent: 'end' }}>
              <label>
                <input
                  type="checkbox"
                  checked={form.isSample}
                  onChange={e =>
                    setForm(f => ({ ...f, isSample: e.target.checked }))
                  }
                />{' '}
                Mark as sample / test
              </label>
            </div>

            {meta.data?.streamConfigured ? (
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Upload video (Stream)</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}

            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Or public HTTPS MP4 URL (dev fallback)</label>
              <input
                value={form.externalPlaybackUrl}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    externalPlaybackUrl: e.target.value,
                  }))
                }
                placeholder="https://…/sample.mp4"
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Poster URL (optional)</label>
              <input
                value={form.externalPosterUrl}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    externalPosterUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Or import existing Cloudflare Stream UID</label>
              <input
                value={form.streamUid}
                onChange={e =>
                  setForm(f => ({ ...f, streamUid: e.target.value }))
                }
                placeholder="abc123…"
                disabled={!meta.data?.streamConfigured}
              />
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              disabled={
                createMutation.isPending ||
                !form.title.trim() ||
                !form.creatorName.trim()
              }
              onClick={() => createMutation.mutate()}
            >
              Save draft
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setShowForm(false);
                setBusyMsg(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        {listQuery.isLoading ? <p className="muted">Loading…</p> : null}
        {listQuery.error ? (
          <p className="error">{(listQuery.error as Error).message}</p>
        ) : null}
        {!listQuery.isLoading && reels.length === 0 ? (
          <p className="muted">No reels in this tab yet.</p>
        ) : null}
        {reels.map(r => (
          <div
            key={r.id}
            style={{
              padding: '14px 0',
              borderBottom: '1px solid var(--line)',
            }}
          >
            <div className="toolbar">
              <div>
                <strong>{r.title}</strong>
                <div className="muted">
                  {r.creatorName}
                  {r.category ? ` · ${r.category}` : ''}
                  {' · '}
                  {r.status}
                  {r.isSample ? ' · sample' : ''}
                  {r.mediaProcessingStatus
                    ? ` · media: ${r.mediaProcessingStatus}`
                    : ' · no video'}
                </div>
                {r.caption ? (
                  <p style={{ margin: '6px 0 0', maxWidth: 560 }}>{r.caption}</p>
                ) : null}
                <div className="muted" style={{ marginTop: 4 }}>
                  ❤️ {r.likeCount} · 💬 {r.commentCount} · 🔖 {r.saveCount}
                  {r.mediaExternalId ? ` · uid ${r.mediaExternalId}` : ''}
                </div>
              </div>
              {canWrite ? (
                <div className="toolbar" style={{ gap: 8 }}>
                  {r.mediaExternalId &&
                  r.mediaProcessingStatus !== 'ready' ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        runAction(`/admin/reels/${r.id}/sync-media`)
                      }
                    >
                      Sync status
                    </button>
                  ) : null}
                  {r.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={r.mediaProcessingStatus !== 'ready'}
                      title={
                        r.mediaProcessingStatus !== 'ready'
                          ? 'Video must be ready'
                          : undefined
                      }
                      onClick={() => runAction(`/admin/reels/${r.id}/publish`)}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() =>
                        runAction(`/admin/reels/${r.id}/unpublish`)
                      }
                    >
                      Unpublish
                    </button>
                  )}
                  {r.status !== 'archived' ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => runAction(`/admin/reels/${r.id}/archive`)}
                    >
                      Archive
                    </button>
                  ) : null}
                  {!r.mediaId && meta.data?.streamConfigured ? (
                    <label className="btn secondary" style={{ cursor: 'pointer' }}>
                      Upload video
                      <input
                        type="file"
                        accept="video/*"
                        hidden
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setError(null);
                          try {
                            setBusyMsg('Creating upload session…');
                            const session = await apiFetch<{
                              uploadUrl: string;
                            }>(`/admin/reels/${r.id}/upload-session`, {
                              method: 'POST',
                            });
                            setBusyMsg('Uploading…');
                            const fd = new FormData();
                            fd.append('file', file);
                            const up = await fetch(session.uploadUrl, {
                              method: 'POST',
                              body: fd,
                            });
                            if (!up.ok) {
                              throw new Error(`Upload failed (${up.status})`);
                            }
                            setBusyMsg('Syncing…');
                            await apiFetch(`/admin/reels/${r.id}/sync-media`, {
                              method: 'POST',
                            });
                            setBusyMsg(null);
                            invalidate();
                          } catch (err) {
                            setBusyMsg(null);
                            setError((err as Error).message);
                          }
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
            {selectedId === r.id && r.playbackUrl ? (
              <p className="muted" style={{ marginTop: 8 }}>
                Playback: {r.playbackUrl}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
