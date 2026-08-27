import React from 'react';
import {
  CommentsBottomSheet,
  CommentsBottomSheetProps,
} from '@/shared/components/CommentsBottomSheet';

/** @deprecated Prefer useCommentsSheetStore.openComments — kept as a thin alias. */
export function ClipCommentsSheet({
  clipId,
  commentCount,
  visible,
  onClose,
  onPlaybackActiveChange,
}: {
  clipId: string;
  commentCount: number;
  visible: boolean;
  onClose: () => void;
  onPlaybackActiveChange?: (shouldPlay: boolean) => void;
}) {
  const props: CommentsBottomSheetProps = {
    sourceType: 'clip',
    contentId: clipId,
    commentCount,
    visible,
    onCloseComplete: onClose,
    onPlaybackActiveChange,
  };
  return <CommentsBottomSheet {...props} />;
}
