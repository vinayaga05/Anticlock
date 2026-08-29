'use client';

import type { ReelPreviewModel } from '@/components/reels/reelPreviewModel';
import {
  describeMobileVisibility,
  formatPreviewCount,
  previewAuthorHandle,
  previewInitials,
} from '@/components/reels/reelPreviewModel';

type Props = {
  model: ReelPreviewModel | null;
  emptyMessage?: string;
};

function SideAction({
  icon,
  label,
}: {
  icon: string;
  label?: string;
}) {
  return (
    <div className="reel-preview-side-action">
      <span className="reel-preview-side-icon" aria-hidden>
        {icon}
      </span>
      {label ? <span className="reel-preview-side-label">{label}</span> : null}
    </div>
  );
}

export function ReelMobilePreview({
  model,
  emptyMessage = 'Select a reel or start a draft to preview the Clips experience.',
}: Props) {
  const visibility = model ? describeMobileVisibility(model) : null;
  const author = model ? previewAuthorHandle(model.creatorName) : '@creator';
  const musicLabel = model?.title?.trim()
    ? `♪ ${model.title.trim()}`
    : '♪ Original audio';
  const hasVideo = Boolean(model?.playbackUrl);

  return (
    <div className="reel-preview-panel">
      <div className="reel-preview-panel-head">
        <strong>Mobile preview</strong>
        <span className="muted">Clips tab</span>
      </div>

      <div className="reel-preview-phone" aria-label="Mobile Clips preview">
        <div className="reel-preview-notch" aria-hidden />
        <div className="reel-preview-screen">
          {model ? (
            <>
              {visibility ? (
                <div
                  className={`reel-preview-visibility reel-preview-visibility-${visibility.tone}`}
                >
                  {visibility.label}
                </div>
              ) : null}

              <div className="reel-preview-media">
                {hasVideo ? (
                  <video
                    key={model.playbackUrl ?? 'empty'}
                    src={model.playbackUrl ?? undefined}
                    poster={model.posterUrl ?? undefined}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="reel-preview-media-placeholder">
                    <span>No video selected</span>
                  </div>
                )}
                <div className="reel-preview-gradient reel-preview-gradient-top" />
                <div className="reel-preview-gradient reel-preview-gradient-bottom" />
              </div>

              <div className="reel-preview-top-bar">
                <span className="reel-preview-icon-pill">⌕</span>
                <div className="reel-preview-top-right">
                  <span className="reel-preview-coins">◎ 120</span>
                  <span className="reel-preview-icon-pill">+</span>
                  <span className="reel-preview-icon-pill">☺</span>
                </div>
              </div>

              <div className="reel-preview-side-actions">
                <SideAction
                  icon="♥"
                  label={formatPreviewCount(model.likeCount)}
                />
                <SideAction
                  icon="💬"
                  label={formatPreviewCount(model.commentCount)}
                />
                <SideAction icon="↗" />
                <SideAction
                  icon="⌁"
                  label={model.saveCount > 0 ? 'Saved' : undefined}
                />
              </div>

              <div className="reel-preview-meta">
                <div className="reel-preview-creator-row">
                  <span className="reel-preview-avatar">
                    {previewInitials(model.creatorName)}
                  </span>
                  <span className="reel-preview-creator">{author}</span>
                </div>
                {model.caption.trim() ? (
                  <p className="reel-preview-caption">{model.caption}</p>
                ) : (
                  <p className="reel-preview-caption reel-preview-caption-empty">
                    Caption will appear here
                  </p>
                )}
                <div className="reel-preview-music">
                  <span aria-hidden>♪</span>
                  <span>{musicLabel}</span>
                </div>
              </div>

              {model.ctaLabel ? (
                <div className="reel-preview-cta">
                  <span aria-hidden>📅</span>
                  <span>{model.ctaLabel}</span>
                </div>
              ) : null}

              <div className="reel-preview-tab-bar">
                <span className="reel-preview-tab active">Clips</span>
                <span className="reel-preview-tab">Flash</span>
                <span className="reel-preview-tab">Needs</span>
                <span className="reel-preview-tab">···</span>
              </div>
            </>
          ) : (
            <div className="reel-preview-empty">{emptyMessage}</div>
          )}
        </div>
      </div>

      {visibility ? (
        <p className="reel-preview-foot muted">{visibility.detail}</p>
      ) : null}
    </div>
  );
}
