"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MediaAsset,
  ReelAdmin,
  ReelAnalyticsSummary,
  ReelContentMode,
  ReelReportAdmin,
} from "@anticlock/contracts";
import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { MediaPicker } from "@/components/media/MediaPicker";
import { ReelMobilePreview } from "@/components/reels/ReelMobilePreview";
import {
  previewFromDraft,
  previewFromReel,
} from "@/components/reels/reelPreviewModel";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  formatBytes,
  formatDuration,
  uploadMediaFile,
} from "@/lib/mediaUpload";

type Tab =
  | "all"
  | "draft"
  | "in_review"
  | "published"
  | "archived"
  | "test"
  | "sample";

type ContentMode = ReelContentMode;

type FormState = {
  title: string;
  caption: string;
  creatorName: string;
  category: string;
  contentMode: ContentMode;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  displayOrder: number;
  externalPlaybackUrl: string;
  externalPosterUrl: string;
  streamUid: string;
};

const emptyForm = (): FormState => ({
  title: "",
  caption: "",
  creatorName: "",
  category: "Fitness",
  contentMode: "sample",
  likeCount: 0,
  commentCount: 0,
  saveCount: 0,
  displayOrder: 0,
  externalPlaybackUrl: "",
  externalPosterUrl: "",
  streamUid: "",
});

function isReadyPublicVideo(asset: MediaAsset) {
  return (
    asset.kind === "video" &&
    asset.processingStatus === "ready" &&
    asset.accessLevel === "public"
  );
}

function displayMode(reel: ReelAdmin): ContentMode {
  return reel.contentMode;
}

function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value > 1 ? value / 100 : value);
}

function formatCount(value: number | undefined) {
  if (value === undefined) return "—";
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ReelsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const canWrite = hasPermission("cms.write");
  const canPublish = hasPermission("cms.publish");
  const canModerate = hasPermission("moderation.act");
  const [tab, setTab] = useState<Tab>("draft");
  const [showForm, setShowForm] = useState(false);
  const [showVideoPicker, setShowVideoPicker] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [analyticsReelId, setAnalyticsReelId] = useState<string | null>(null);
  const [actionPath, setActionPath] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [previewReelId, setPreviewReelId] = useState<string | null>(null);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ["admin", "reels", "meta"],
    queryFn: () => apiFetch<{ streamConfigured: boolean }>("/admin/reels/meta"),
  });

  const listQuery = useQuery({
    queryKey: ["admin", "reels", tab],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (tab === "published") params.set("status", "published");
      if (tab === "draft") params.set("status", "draft");
      if (tab === "in_review") params.set("status", "in_review");
      if (tab === "archived") params.set("status", "archived");
      if (tab === "test" || tab === "sample") {
        params.set("contentMode", tab);
      }
      return apiFetch<{ data: ReelAdmin[] }>(`/admin/reels?${params}`);
    },
  });

  const reels = useMemo(() => {
    const data = listQuery.data?.data ?? [];
    if (tab === "test" || tab === "sample") {
      return data.filter((reel) => displayMode(reel) === tab);
    }
    return data;
  }, [listQuery.data, tab]);

  const previewReel = useMemo(
    () => reels.find((reel) => reel.id === previewReelId) ?? null,
    [previewReelId, reels],
  );

  const previewModel = useMemo(() => {
    if (showForm) {
      return previewFromDraft(form, selectedMedia);
    }
    if (previewReel) {
      return previewFromReel(previewReel);
    }
    return null;
  }, [showForm, form, selectedMedia, previewReel]);

  const analyticsQuery = useQuery({
    queryKey: ["admin", "reels", analyticsReelId, "analytics"],
    queryFn: () =>
      apiFetch<{ data: ReelAnalyticsSummary }>(
        `/admin/reels/${analyticsReelId}/analytics`
      ),
    enabled: Boolean(analyticsReelId),
  });

  const reportsQuery = useQuery({
    queryKey: ["admin", "reels", "reports", "open"],
    queryFn: () =>
      apiFetch<{ data: ReelReportAdmin[] }>(
        "/admin/reels/reports?status=open&limit=50"
      ),
    enabled: canModerate,
  });

  const invalidateReels = () => {
    qc.invalidateQueries({ queryKey: ["admin", "reels"] });
    qc.invalidateQueries({ queryKey: ["admin", "media"] });
  };

  const clearForm = () => {
    setForm(emptyForm());
    setSelectedMedia(null);
    setShowVideoPicker(false);
    setUploadProgress(null);
    setError(null);
  };

  const selectVideo = (asset: MediaAsset) => {
    if (!isReadyPublicVideo(asset)) {
      setError("Choose a ready, public video from the Media Library.");
      return;
    }
    setSelectedMedia(asset);
    setError(null);
  };

  const uploadVideo = async (file: File) => {
    setError(null);
    setBusyMsg("Checking MP4 metadata…");
    setUploadProgress(0);
    setIsUploadingVideo(true);

    try {
      const result = await uploadMediaFile({
        file,
        kind: "video",
        accessLevel: "public",
        entityHint: "reels",
        onProgress: (progress) => {
          setUploadProgress(progress);
          if (progress < 8) setBusyMsg("Checking MP4 metadata…");
          else if (progress < 94) setBusyMsg(`Uploading video… ${progress}%`);
          else setBusyMsg("Confirming upload…");
        },
      });

      selectVideo(result.asset);
      setBusyMsg(
        "Video is ready in the Media Library. Save this Reel as a draft, then publish it when you are ready."
      );
      await qc.invalidateQueries({ queryKey: ["admin", "media"] });
    } catch (err) {
      setBusyMsg(null);
      setError((err as Error).message);
    } finally {
      setIsUploadingVideo(false);
      setUploadProgress(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setBusyMsg("Creating draft…");

      const streamUid = form.streamUid.trim();
      const externalPlaybackUrl = form.externalPlaybackUrl.trim();
      if (selectedMedia && (streamUid || externalPlaybackUrl)) {
        throw new Error(
          "Choose either a Media Library video or a legacy Stream/external source, not both."
        );
      }

      if (streamUid) {
        return apiFetch<{ data: ReelAdmin }>("/admin/reels/import-stream", {
          method: "POST",
          body: JSON.stringify({
            streamUid,
            title: form.title,
            caption: form.caption || undefined,
            creatorName: form.creatorName,
            category: form.category || undefined,
            contentMode: form.contentMode,
            isSample: form.contentMode === "sample",
            likeCount: form.likeCount,
            commentCount: form.commentCount,
            saveCount: form.saveCount,
            displayOrder: form.displayOrder,
          }),
        });
      }

      return apiFetch<{ data: ReelAdmin }>("/admin/reels", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          caption: form.caption || undefined,
          creatorName: form.creatorName,
          category: form.category || undefined,
          contentMode: form.contentMode,
          isSample: form.contentMode === "sample",
          likeCount: form.likeCount,
          commentCount: form.commentCount,
          saveCount: form.saveCount,
          displayOrder: form.displayOrder,
          mediaId: selectedMedia?.id,
          externalPlaybackUrl: externalPlaybackUrl || undefined,
          externalPosterUrl: form.externalPosterUrl.trim() || undefined,
        }),
      });
    },
    onSuccess: (res) => {
      setSelectedId(res.data.id);
      setPreviewReelId(res.data.id);
      setShowForm(false);
      clearForm();
      setBusyMsg(null);
      invalidateReels();
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
    },
    onError: (err: Error) => {
      setBusyMsg(null);
      setError(err.message);
    },
  });

  async function runAction(path: string, method: "POST" | "PATCH" = "POST") {
    setError(null);
    setActionPath(path);
    try {
      await apiFetch(path, { method });
      invalidateReels();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPath(null);
    }
  }

  async function resolveReport(
    report: ReelReportAdmin,
    action: "dismiss" | "return_to_review" | "restrict_reel" | "remove_reel"
  ) {
    const needsConfirmation =
      action === "restrict_reel" || action === "remove_reel";
    if (
      needsConfirmation &&
      !window.confirm(
        action === "remove_reel"
          ? `Remove “${report.reelTitle ?? "this Reel"}” from the mobile feed?`
          : `Restrict “${
              report.reelTitle ?? "this Reel"
            }” and return it to review?`
      )
    ) {
      return;
    }

    const path = `/admin/reels/reports/${report.id}/resolve`;
    setError(null);
    setActionPath(path);
    try {
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({
          action,
          note: reportNotes[report.id]?.trim() || undefined,
        }),
      });
      setReportNotes((notes) => {
        const next = { ...notes };
        delete next[report.id];
        return next;
      });
      invalidateReels();
      qc.invalidateQueries({ queryKey: ["admin", "reels", "reports"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionPath(null);
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Reels</h1>
      <p className="page-sub">
        Media Library upload → Draft → Review → Published. Uploading stores a
        video in R2 only; it never publishes a Reel. Mobile Clips receives only
        published, ready, unrestricted Reels.
        {meta.data?.streamConfigured
          ? " A legacy Cloudflare Stream import is also available below."
          : null}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Publishing safeguards</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Submit a completed draft for review before publishing. Test Reels are
          never eligible for the public mobile feed; Standard and Sample Reels
          still require an explicit Publish action.
        </p>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div className="tabs">
          {(
            [
              ["all", "All"],
              ["draft", "Drafts"],
              ["in_review", "In review"],
              ["published", "Published"],
              ["test", "Tests"],
              ["sample", "Samples"],
              ["archived", "Archived"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "btn" : "btn secondary"}
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
              clearForm();
              setBusyMsg(null);
              setPreviewReelId(null);
            }}
          >
            + Add Reel
          </button>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {busyMsg ? <p className="muted">{busyMsg}</p> : null}

      <div className="reels-workspace">
        <div className="reels-workspace-main">
      {showForm ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginTop: 0 }}>New reel draft</h2>
          <p className="muted" style={{ marginTop: -4 }}>
            Uploading a video adds it to the Media Library only. This form saves
            a draft; publishing is a separate action.
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Title</label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Morning Workout"
              />
            </div>
            <div className="field">
              <label>Creator</label>
              <input
                value={form.creatorName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, creatorName: e.target.value }))
                }
                placeholder="Ravi Kumar"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Caption</label>
              <textarea
                rows={3}
                value={form.caption}
                onChange={(e) =>
                  setForm((f) => ({ ...f, caption: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Category</label>
              <input
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Display order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm((f) => ({
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
                onChange={(e) =>
                  setForm((f) => ({
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
                onChange={(e) =>
                  setForm((f) => ({
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    saveCount: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>Content mode</label>
              <select
                value={form.contentMode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contentMode: event.target.value as ContentMode,
                  }))
                }
              >
                <option value="standard">Standard</option>
                <option value="sample">Sample</option>
                <option value="test">Test (never public)</option>
              </select>
              <span className="muted">
                Tests stay out of the mobile feed. Samples can be reviewed and
                published explicitly.
              </span>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Video from Media Library</label>
              <p className="muted" style={{ marginTop: 4 }}>
                MP4 only, maximum 3 minutes. 9:16 at 1080 × 1920 is recommended.
              </p>
              {selectedMedia ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                >
                  {selectedMedia.deliveryUrl ? (
                    <video
                      src={selectedMedia.deliveryUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: 72, height: 96, objectFit: "cover" }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>
                      {selectedMedia.originalFilename ??
                        selectedMedia.id.slice(0, 8)}
                    </strong>
                    <div className="muted">
                      {formatBytes(selectedMedia.byteSize)} ·{" "}
                      {formatDuration(selectedMedia.durationMs)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setSelectedMedia(null)}
                    disabled={isUploadingVideo}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 4 }}>
                  No library video selected. You can still save an empty draft.
                </p>
              )}
              <div className="toolbar" style={{ marginTop: 10, gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowVideoPicker(true)}
                  disabled={isUploadingVideo}
                >
                  Choose from Media Library
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploadingVideo}
                >
                  {isUploadingVideo ? "Uploading…" : "Upload MP4"}
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="video/mp4,.mp4"
                  hidden
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void uploadVideo(file);
                  }}
                />
              </div>
              {uploadProgress !== null ? (
                <div style={{ marginTop: 10 }}>
                  <progress value={uploadProgress} max={100} />{" "}
                  <span className="muted">{uploadProgress}%</span>
                </div>
              ) : null}
            </div>

            <details className="field" style={{ gridColumn: "1 / -1" }}>
              <summary>Legacy / development video source</summary>
              <p className="muted" style={{ marginTop: 8 }}>
                Use this only for an existing Cloudflare Stream video or a
                development HTTPS MP4. It cannot be combined with a Media
                Library video.
              </p>
              <div className="field">
                <label>Existing Cloudflare Stream UID</label>
                <input
                  value={form.streamUid}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, streamUid: e.target.value }))
                  }
                  placeholder="abc123…"
                  disabled={!meta.data?.streamConfigured}
                />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label>Public HTTPS MP4 URL (development fallback)</label>
                <input
                  value={form.externalPlaybackUrl}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      externalPlaybackUrl: e.target.value,
                    }))
                  }
                  placeholder="https://…/sample.mp4"
                />
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <label>Poster URL (optional)</label>
                <input
                  value={form.externalPosterUrl}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      externalPosterUrl: e.target.value,
                    }))
                  }
                />
              </div>
            </details>
          </div>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              disabled={
                createMutation.isPending ||
                isUploadingVideo ||
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
                clearForm();
                setBusyMsg(null);
              }}
              disabled={isUploadingVideo}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <MediaPicker
        open={showVideoPicker}
        kind="video"
        onClose={() => setShowVideoPicker(false)}
        onSelect={selectVideo}
      />

      <div className="card">
        {listQuery.isLoading ? <p className="muted">Loading…</p> : null}
        {listQuery.error ? (
          <p className="error">{(listQuery.error as Error).message}</p>
        ) : null}
        {!listQuery.isLoading && reels.length === 0 ? (
          <p className="muted">No reels in this tab yet.</p>
        ) : null}
        {reels.map((reel) => {
          const contentMode = displayMode(reel);
          const isReady = reel.mediaProcessingStatus === "ready";
          const isTest = contentMode === "test";

          return (
            <div
              key={reel.id}
              className={previewReelId === reel.id ? "reel-row-previewing" : ""}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div className="toolbar">
                <div>
                  <strong>{reel.title}</strong>
                  <div className="muted">
                    {reel.creatorName}
                    {reel.category ? ` · ${reel.category}` : ""}
                    {" · "}
                    <span className="badge">
                      {reel.status.replace("_", " ")}
                    </span>
                    <span className="badge">{contentMode}</span>
                    {reel.moderationStatus ? (
                      <span className="badge">
                        moderation: {reel.moderationStatus.replace("_", " ")}
                      </span>
                    ) : null}
                    {reel.mediaProcessingStatus
                      ? ` media: ${reel.mediaProcessingStatus}`
                      : " no video"}
                  </div>
                  {reel.caption ? (
                    <p style={{ margin: "6px 0 0", maxWidth: 560 }}>
                      {reel.caption}
                    </p>
                  ) : null}
                  <div className="muted" style={{ marginTop: 4 }}>
                    {formatCount(reel.viewCount)} views · ❤️{" "}
                    {formatCount(reel.likeCount)}
                    {" · "}💬 {formatCount(reel.commentCount)} · 🔖{" "}
                    {formatCount(reel.saveCount)} ·{" "}
                    {formatPercent(reel.completionRate)}
                    completion
                    {reel.reportCount
                      ? ` · ⚑ ${reel.reportCount} report${
                          reel.reportCount === 1 ? "" : "s"
                        }`
                      : ""}
                    {reel.mediaExternalId
                      ? ` · uid ${reel.mediaExternalId}`
                      : ""}
                  </div>
                  {reel.status === "in_review" && reel.submittedForReviewAt ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      Submitted for review{" "}
                      {formatDateTime(reel.submittedForReviewAt)}
                    </div>
                  ) : null}
                  {isTest ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      Test content is intentionally excluded from the mobile
                      feed.
                    </div>
                  ) : null}
                </div>
                <div className="toolbar" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className={
                      previewReelId === reel.id && !showForm
                        ? "btn"
                        : "btn secondary"
                    }
                    onClick={() => {
                      setPreviewReelId(reel.id);
                      setShowForm(false);
                    }}
                    disabled={Boolean(actionPath)}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setAnalyticsReelId(reel.id)}
                    disabled={Boolean(actionPath)}
                  >
                    Analytics
                  </button>
                  {canWrite &&
                  reel.mediaExternalId &&
                  reel.mediaProcessingStatus !== "ready" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(actionPath)}
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/sync-media`)
                      }
                    >
                      Sync status
                    </button>
                  ) : null}
                  {canWrite && reel.status === "draft" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(actionPath) || !isReady}
                      title={
                        !isReady
                          ? "Video must be ready before review"
                          : undefined
                      }
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/submit-review`)
                      }
                    >
                      Submit for review
                    </button>
                  ) : null}
                  {canWrite && reel.status === "in_review" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(actionPath)}
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/return-to-draft`)
                      }
                    >
                      Return to draft
                    </button>
                  ) : null}
                  {canPublish && reel.status === "in_review" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={Boolean(actionPath) || !isReady || isTest}
                      title={
                        isTest
                          ? "Test Reels cannot be published"
                          : !isReady
                          ? "Video must be ready before publishing"
                          : undefined
                      }
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/publish`)
                      }
                    >
                      Publish
                    </button>
                  ) : null}
                  {canPublish && reel.status === "published" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(actionPath)}
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/unpublish`)
                      }
                    >
                      Unpublish
                    </button>
                  ) : null}
                  {canWrite &&
                  reel.status !== "archived" &&
                  (reel.status !== "published" || canPublish) ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(actionPath)}
                      onClick={() =>
                        runAction(`/admin/reels/${reel.id}/archive`)
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedId === reel.id && reel.playbackUrl ? (
                <p className="muted" style={{ marginTop: 8 }}>
                  Playback: {reel.playbackUrl}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {analyticsReelId ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="toolbar">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Reel analytics</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Server-recorded engagement and completion data.
              </p>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setAnalyticsReelId(null)}
            >
              Close
            </button>
          </div>
          {analyticsQuery.isLoading ? (
            <p className="muted">Loading analytics…</p>
          ) : null}
          {analyticsQuery.error ? (
            <p className="error">{(analyticsQuery.error as Error).message}</p>
          ) : null}
          {analyticsQuery.data ? (
            <>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <div className="card">
                  <span className="muted">Views</span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "1.45rem",
                      marginTop: 4,
                    }}
                  >
                    {formatCount(analyticsQuery.data.data.views)}
                  </strong>
                </div>
                <div className="card">
                  <span className="muted">Completion rate</span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "1.45rem",
                      marginTop: 4,
                    }}
                  >
                    {formatPercent(analyticsQuery.data.data.completionRate)}
                  </strong>
                  <span className="muted">
                    {formatCount(analyticsQuery.data.data.completedViews)}{" "}
                    completions
                  </span>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 12 }}>
                ❤️ {formatCount(analyticsQuery.data.data.likes)} likes
                {" · "}💬 {formatCount(analyticsQuery.data.data.comments)}{" "}
                comments
                {" · "}⚑ {formatCount(analyticsQuery.data.data.reports)} reports
              </div>
              {analyticsQuery.data.data.daily.length ? (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Views</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Completions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsQuery.data.data.daily.map((point) => (
                        <tr key={point.date}>
                          <td>{point.date}</td>
                          <td>{formatCount(point.views)}</td>
                          <td>{formatCount(point.likes)}</td>
                          <td>{formatCount(point.comments)}</td>
                          <td>{formatCount(point.completedViews)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 12 }}>
                  No daily analytics have been recorded yet.
                </p>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {canModerate ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="toolbar">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                Open Reel reports
              </h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Resolve reports with a recorded moderation action. Restricting
                or removing a Reel takes it out of public delivery immediately.
              </p>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => reportsQuery.refetch()}
              disabled={reportsQuery.isFetching}
            >
              Refresh
            </button>
          </div>
          {reportsQuery.isLoading ? (
            <p className="muted">Loading reports…</p>
          ) : null}
          {reportsQuery.error ? (
            <p className="error">{(reportsQuery.error as Error).message}</p>
          ) : null}
          {!reportsQuery.isLoading && reportsQuery.data?.data.length === 0 ? (
            <p className="muted">No open Reel reports.</p>
          ) : null}
          {reportsQuery.data?.data.map((report) => {
            return (
              <div
                key={report.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <strong>
                  {report.reelTitle ?? `Reel ${report.reelId.slice(0, 8)}`}
                </strong>
                <div className="muted" style={{ marginTop: 4 }}>
                  {report.reason}
                  {report.reporterKey
                    ? ` · reported by ${report.reporterKind.replace("_", " ")}`
                    : ""}
                  {formatDateTime(report.createdAt)
                    ? ` · ${formatDateTime(report.createdAt)}`
                    : ""}
                </div>
                {report.details ? (
                  <p style={{ margin: "6px 0 0", maxWidth: 680 }}>
                    {report.details}
                  </p>
                ) : null}
                <div className="toolbar" style={{ marginTop: 10, gap: 8 }}>
                  <input
                    aria-label={`Moderation note for ${
                      report.reelTitle ?? report.reelId
                    }`}
                    value={reportNotes[report.id] ?? ""}
                    onChange={(event) =>
                      setReportNotes((notes) => ({
                        ...notes,
                        [report.id]: event.target.value,
                      }))
                    }
                    placeholder="Optional resolution note"
                    style={{ minWidth: 220, flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={Boolean(actionPath)}
                    onClick={() => resolveReport(report, "dismiss")}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={Boolean(actionPath)}
                    onClick={() => resolveReport(report, "return_to_review")}
                  >
                    Send to review
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={Boolean(actionPath)}
                    onClick={() => resolveReport(report, "restrict_reel")}
                  >
                    Restrict
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={Boolean(actionPath)}
                    onClick={() => resolveReport(report, "remove_reel")}
                  >
                    Remove from feed
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
        </div>
        <aside className="reels-workspace-preview">
          <ReelMobilePreview model={previewModel} />
        </aside>
      </div>
    </AdminShell>
  );
}
