import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

/** Deep-link entry: jump to Main/Flash and open the shared comments sheet. */
export function FlashCommentsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'FlashComments'>>();
  const { postId } = route.params;
  const post = useEngagementStore(s => s.posts.find(p => p.id === postId));
  const openComments = useCommentsSheetStore(s => s.openComments);

  useEffect(() => {
    openComments({
      sourceType: 'flashPost',
      contentId: postId,
      commentCount: post?.commentCount ?? 0,
      commentsEnabled: post?.commentsEnabled !== false,
    });
    navigation.navigate('Main', { screen: 'Flash' });
  }, [navigation, openComments, post?.commentCount, post?.commentsEnabled, postId]);

  return <View style={[styles.root, { backgroundColor: theme.colors.background }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
