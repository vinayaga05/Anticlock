import { create } from 'zustand';

export type CommentsSourceType = 'clip' | 'flashPost';

type OpenPayload = {
  sourceType: CommentsSourceType;
  contentId: string;
  commentCount: number;
  commentsEnabled?: boolean;
};

type CommentsSheetState = {
  open: boolean;
  closing: boolean;
  sourceType: CommentsSourceType | null;
  contentId: string | null;
  commentCount: number;
  commentsEnabled: boolean;
  /** Clips: whether the reel should keep playing under the sheet. */
  playbackActive: boolean;
  pendingAfterClose: (() => void) | null;

  openComments: (payload: OpenPayload) => void;
  requestClose: (after?: () => void) => void;
  completeClose: () => void;
  setPlaybackActive: (active: boolean) => void;
  setCommentCount: (count: number) => void;
};

export const useCommentsSheetStore = create<CommentsSheetState>((set, get) => ({
  open: false,
  closing: false,
  sourceType: null,
  contentId: null,
  commentCount: 0,
  commentsEnabled: true,
  playbackActive: true,
  pendingAfterClose: null,

  openComments: payload =>
    set({
      open: true,
      closing: false,
      sourceType: payload.sourceType,
      contentId: payload.contentId,
      commentCount: payload.commentCount,
      commentsEnabled: payload.commentsEnabled !== false,
      playbackActive: true,
      pendingAfterClose: null,
    }),

  requestClose: after => {
    const { open, closing } = get();
    if (!open && !closing) {
      after?.();
      return;
    }
    set({
      closing: true,
      pendingAfterClose: after ?? null,
    });
  },

  completeClose: () => {
    const after = get().pendingAfterClose;
    set({
      open: false,
      closing: false,
      sourceType: null,
      contentId: null,
      commentCount: 0,
      commentsEnabled: true,
      playbackActive: true,
      pendingAfterClose: null,
    });
    after?.();
  },

  setPlaybackActive: active => set({ playbackActive: active }),
  setCommentCount: count => set({ commentCount: count }),
}));

/** Floating pill bar height (excludes safe-area padding). */
export const TAB_BAR_PILL_HEIGHT = 66;

/** Safe-area padding under the composer when the sheet covers the tab bar. */
export function getSheetBottomInset(bottomInset: number) {
  return Math.max(bottomInset, 12);
}

/** @deprecated Sheet now stacks above the tab bar; use getSheetBottomInset. */
export function getTabBarClearance(bottomInset: number) {
  return getSheetBottomInset(bottomInset);
}
