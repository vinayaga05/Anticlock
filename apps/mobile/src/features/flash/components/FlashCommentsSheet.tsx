import React from 'react';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

/** @deprecated Prefer useCommentsSheetStore.openComments */
export function FlashCommentsSheet({
  postId,
  commentCount,
  visible,
  onClose,
  commentsEnabled = true,
}: {
  postId: string;
  commentCount: number;
  visible: boolean;
  onClose: () => void;
  commentsEnabled?: boolean;
}) {
  const openComments = useCommentsSheetStore(s => s.openComments);
  const requestClose = useCommentsSheetStore(s => s.requestClose);

  React.useEffect(() => {
    if (visible) {
      openComments({
        sourceType: 'flashPost',
        contentId: postId,
        commentCount,
        commentsEnabled,
      });
    } else {
      requestClose(onClose);
    }
  }, [
    visible,
    postId,
    commentCount,
    commentsEnabled,
    openComments,
    requestClose,
    onClose,
  ]);

  return null;
}
