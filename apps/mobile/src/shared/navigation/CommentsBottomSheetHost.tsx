import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { CommentsBottomSheet } from '@/shared/components/CommentsBottomSheet';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Mounts the shared comments sheet in the tab-bar stacking context so it
 * paints under the floating pill (zIndex 30) and above feed content.
 */
export function CommentsBottomSheetHost() {
  const open = useCommentsSheetStore(s => s.open);
  const closing = useCommentsSheetStore(s => s.closing);
  const sourceType = useCommentsSheetStore(s => s.sourceType);
  const contentId = useCommentsSheetStore(s => s.contentId);
  const commentCount = useCommentsSheetStore(s => s.commentCount);
  const commentsEnabled = useCommentsSheetStore(s => s.commentsEnabled);
  const completeClose = useCommentsSheetStore(s => s.completeClose);
  const setPlaybackActive = useCommentsSheetStore(s => s.setPlaybackActive);

  if ((!open && !closing) || !sourceType || !contentId) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { height: SCREEN_HEIGHT }]}>
      <CommentsBottomSheet
        sourceType={sourceType}
        contentId={contentId}
        commentCount={commentCount}
        visible={open}
        closing={closing}
        commentsEnabled={commentsEnabled}
        onCloseComplete={completeClose}
        onPlaybackActiveChange={setPlaybackActive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
});
