import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  PostMedia,
  PostVisibility,
} from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { CURRENT_USER } from '@/shared/data/flash';

const VISIBILITY: { id: PostVisibility; label: string }[] = [
  { id: 'public', label: 'Public' },
  { id: 'followers', label: 'Followers' },
  { id: 'friends', label: 'Friends' },
  { id: 'community', label: 'Community' },
  { id: 'only_me', label: 'Only me' },
];

const SAMPLE_MEDIA: PostMedia[] = [
  {
    id: 'sample-img',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&h=600&q=80',
  },
  {
    id: 'sample-vid',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&h=600&q=80',
  },
];

export function FlashComposerScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const publishPost = useEngagementStore(s => s.publishPost);

  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [media, setMedia] = useState<PostMedia[]>([]);

  const publish = () => {
    if (!text.trim() && media.length === 0) return;
    publishPost({
      text: text.trim(),
      visibility,
      media,
    });
    navigation.goBack();
  };

  const toggleSampleMedia = (item: PostMedia) => {
    setMedia(prev =>
      prev.some(m => m.id === item.id)
        ? prev.filter(m => m.id !== item.id)
        : [...prev, item],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: 120,
          gap: theme.spacing.lg,
        }}>
        <View style={styles.author}>
          <Image source={{ uri: CURRENT_USER.avatarUrl }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
              {CURRENT_USER.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Visibility
            </Text>
          </View>
        </View>

        <FilterPills
          activeId={visibility}
          onChange={id => setVisibility(id as PostVisibility)}
          pills={VISIBILITY}
        />

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What’s happening?"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
            },
          ]}
        />

        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Add media (mock)
        </Text>
        <View style={styles.row}>
          {SAMPLE_MEDIA.map(m => {
            const active = media.some(x => x.id === m.id);
            return (
              <PressableScale
                key={m.id}
                onPress={() => toggleSampleMedia(m)}
                style={[
                  styles.mediaChip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                ]}>
                <Image
                  source={{ uri: m.posterUrl ?? m.url }}
                  style={styles.mediaThumb}
                />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {m.type}
                  {active ? ' · added' : ''}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {media.length > 0 ? (
          <PressableScale onPress={() => setMedia([])}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
              Clear media
            </Text>
          </PressableScale>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.backgroundElevated,
          },
        ]}>
        <Button title="Publish" onPress={publish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  input: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  mediaChip: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 6,
    paddingBottom: 8,
  },
  mediaThumb: { width: '100%', height: 90 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
