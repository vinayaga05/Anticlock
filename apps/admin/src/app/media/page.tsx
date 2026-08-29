"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MediaAccessLevel,
  MediaAsset,
  MediaUsage,
} from "@anticlock/contracts";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  formatBytes,
  formatDuration,
  uploadMediaFile,
} from "@/lib/mediaUpload";

type DetailResponse = { asset: MediaAsset; usages: MediaUsage[] };

export default function MediaLibraryPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const canModerate = hasPermission("moderation.act");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "image" | "document" | "video">(
    "all"
  );
  const [status, setStatus] = useState<string>("ready");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<MediaAccessLevel>("public");
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<MediaAsset | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin", "media", q, kind, status],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "60" });
      if (q) params.set("q", q);
      if (kind !== "all") params.set("kind", kind);
      if (status) params.set("status", status);
      return apiFetch<{ data: MediaAsset[] }>(`/admin/media?${params}`);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "media", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<DetailResponse>(`/admin/media/${selectedId}`),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/media/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      setSelectedId(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/media/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      setSelectedId(null);
    },
  });

  const updateModeration = useMutation({
    mutationFn: (input: {
      id: string;
      status: "approved" | "manual_review" | "rejected";
    }) =>
      apiFetch(`/admin/media/${input.id}/moderation`, {
        method: "POST",
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      qc.invalidateQueries({ queryKey: ["admin", "reels"] });
    },
  });

  const assets = listQuery.data?.data ?? [];
  const detail = detailQuery.data;

  const kindTabs = useMemo(
    () =>
      [
        { id: "all" as const, label: "All" },
        { id: "image" as const, label: "Images" },
        { id: "document" as const, label: "Documents" },
        { id: "video" as const, label: "Videos" },
      ] as const,
    []
  );

  async function onFile(file: File) {
    setUploadError(null);
    setDuplicate(null);
    setProgress(0);
    try {
      const mime = file.type.trim().toLowerCase().split(";", 1)[0] ?? "";
      const kindGuess =
        mime === "video/mp4"
          ? "video"
          : mime.startsWith("image/")
          ? "image"
          : "document";
      const result = await uploadMediaFile({
        file,
        kind: kindGuess,
        accessLevel,
        onProgress: setProgress,
      });
      if (result.duplicateOf) setDuplicate(result.duplicateOf);
      await qc.invalidateQueries({ queryKey: ["admin", "media"] });
      setSelectedId(result.asset.id);
      setUploadOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <AdminShell>
      <div className="toolbar">
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Media
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Library for images, documents, and videos — upload once, reuse
            everywhere.
          </p>
        </div>
        {hasPermission("media.write") ? (
          <button
            type="button"
            className="btn"
            onClick={() => setUploadOpen(true)}
          >
            + Upload
          </button>
        ) : null}
      </div>

      <div className="toolbar" style={{ marginBottom: 16, gap: 10 }}>
        <input
          style={{ flex: 1, minWidth: 160 }}
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
          <option value="initiated">Initiated</option>
        </select>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {kindTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${kind === t.id ? " active" : ""}`}
            onClick={() => setKind(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div>
          {listQuery.isLoading ? <p className="muted">Loading…</p> : null}
          {listQuery.error ? (
            <p className="error">{(listQuery.error as Error).message}</p>
          ) : null}
          <div className="media-grid">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className={`media-card${
                  selectedId === asset.id ? " selected" : ""
                }`}
                onClick={() => setSelectedId(asset.id)}
              >
                <div className="media-thumb">
                  {asset.kind === "image" && asset.deliveryUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.deliveryUrl} alt="" />
                  ) : asset.kind === "video" && asset.deliveryUrl ? (
                    <video
                      src={asset.deliveryUrl}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <span className="muted">
                      {asset.kind === "video" ? "MP4" : "PDF"}
                    </span>
                  )}
                </div>
                <div className="media-meta">
                  <strong>
                    {asset.originalFilename ?? asset.id.slice(0, 8)}
                  </strong>
                  <span className="muted">
                    {asset.processingStatus} · {formatBytes(asset.byteSize)}
                    {asset.kind === "video"
                      ? ` · ${formatDuration(asset.durationMs)}`
                      : ""}
                    {asset.usageCount != null
                      ? ` · ${asset.usageCount} uses`
                      : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {!selectedId ? (
            <p className="muted">Select an asset to view details.</p>
          ) : detailQuery.isLoading ? (
            <p className="muted">Loading…</p>
          ) : detail ? (
            <>
              <div className="media-thumb large">
                {detail.asset.kind === "image" && detail.asset.deliveryUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.asset.deliveryUrl} alt="" />
                ) : detail.asset.kind === "video" &&
                  detail.asset.deliveryUrl ? (
                  <video
                    src={detail.asset.deliveryUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <span className="muted">
                    {detail.asset.kind === "video" ? "Video" : "Document"}
                  </span>
                )}
              </div>
              <h3 style={{ marginTop: 12 }}>
                {detail.asset.originalFilename ?? "Untitled"}
              </h3>
              <dl className="meta-list">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="badge">
                      {detail.asset.processingStatus}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Moderation</dt>
                  <dd>{detail.asset.moderationStatus.replace("_", " ")}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>{detail.asset.accessLevel}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{detail.asset.kind}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatBytes(detail.asset.byteSize)}</dd>
                </div>
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {detail.asset.width && detail.asset.height
                      ? `${detail.asset.width} × ${detail.asset.height}`
                      : "—"}
                  </dd>
                </div>
                {detail.asset.kind === "video" ? (
                  <div>
                    <dt>Duration</dt>
                    <dd>{formatDuration(detail.asset.durationMs)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Uploaded by</dt>
                  <dd>{detail.asset.createdByName ?? "—"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(detail.asset.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              <h4>Used by</h4>
              {detail.usages.length === 0 ? (
                <p className="muted">Not used yet.</p>
              ) : (
                <ul className="usage-list">
                  {detail.usages.map((u) => (
                    <li key={u.id}>
                      <strong>{u.entityType}</strong>{" "}
                      {u.entityLabel ?? u.entityId}{" "}
                      <span className="muted">({u.usageType})</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="toolbar" style={{ marginTop: 16 }}>
                {canModerate && detail.asset.processingStatus === "ready" ? (
                  <>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={updateModeration.isPending}
                      onClick={() =>
                        updateModeration.mutate({
                          id: detail.asset.id,
                          status: "approved",
                        })
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={updateModeration.isPending}
                      onClick={() =>
                        updateModeration.mutate({
                          id: detail.asset.id,
                          status: "manual_review",
                        })
                      }
                    >
                      Hold for review
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={updateModeration.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Reject this media asset? It will be removed from every public Reel that uses it."
                          )
                        ) {
                          updateModeration.mutate({
                            id: detail.asset.id,
                            status: "rejected",
                          });
                        }
                      }}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {hasPermission("media.write") ? (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => archive.mutate(detail.asset.id)}
                  >
                    Archive
                  </button>
                ) : null}
                {hasPermission("media.delete") ? (
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={
                      (detail.asset.usageCount ?? detail.usages.length) > 0
                    }
                    title={
                      detail.usages.length > 0
                        ? "Remove usages before deleting"
                        : undefined
                    }
                    onClick={() => remove.mutate(detail.asset.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              {remove.isError ? (
                <p className="error">{(remove.error as Error).message}</p>
              ) : null}
              {updateModeration.isError ? (
                <p className="error">
                  {(updateModeration.error as Error).message}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {uploadOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="toolbar">
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Upload</h2>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </button>
            </div>
            <div className="field">
              <label>Visibility</label>
              <select
                value={accessLevel}
                onChange={(e) =>
                  setAccessLevel(e.target.value as MediaAccessLevel)
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="field">
              <label>File</label>
              <p className="muted" style={{ margin: 0 }}>
                Reel video: MP4 only, up to 3 minutes. Vertical 9:16 at 1080 ×
                1920 is recommended.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </div>
            {progress > 0 && progress < 100 ? (
              <>
                <progress
                  value={progress}
                  max={100}
                  style={{ width: "100%" }}
                />
                <p className="muted">Uploading… {progress}%</p>
              </>
            ) : null}
            {uploadError ? <p className="error">{uploadError}</p> : null}
            {duplicate ? (
              <p className="muted">
                Duplicate detected — existing asset{" "}
                <strong>{duplicate.originalFilename}</strong> shares this
                checksum. You can reuse it from the picker.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
