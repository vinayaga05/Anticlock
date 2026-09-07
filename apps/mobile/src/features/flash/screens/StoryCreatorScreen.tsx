import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  STORY_SAMPLE_PHOTOS,
  STORY_TEXT_BACKGROUNDS,
} from '@/shared/data/flash/stories';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import type { StoryAudience, StoryMediaType } from '@/shared/data/flash/storyTypes';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  usePublishContentMutation,
  usePublishingIdentitiesQuery,
} from '@/shared/api/publishingHooks';
import { isApiEnabled } from '@/shared/api/config';

const AUDIENCE: { id: StoryAudience; label: string }[] = [
  { id: 'followers', label: 'Followers' },
  { id: 'close_friends', label: 'Close Friends' },
  { id: 'selected', label: 'Selected People' },
];

const MODES: { id: StoryMediaType; label: string; icon: 'camera' | 'image' | 'edit' }[] = [
  { id: 'photo', label: 'Photo', icon: 'image' },
  { id: 'video', label: 'Video', icon: 'camera' },
  { id: 'text', label: 'Text Story', icon: 'edit' },
];

export function StoryCreatorScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const publishStory = useStoryStore(s => s.publishStory);
  const { data: identities = [] } = usePublishingIdentitiesQuery();
  const publishContent = usePublishContentMutation();

  const [mode, setMode] = useState<StoryMediaType>('photo');
  const [audience, setAudience] = useState<StoryAudience>('followers');
  const [text, setText] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [identityId, setIdentityId] = useState<string | null>(null);

  useEffect(() => {
    if (!identityId && identities[0]) setIdentityId(identities[0].id);
  }, [identities, identityId]);

  const identity = identities.find(item => item.id === identityId) ?? identities[0];
  const identityPills = useMemo(
    () => identities.map(item => ({
      id: item.id,
      label: item.type === 'provider' ? item.name : 'Personal',
    })),
    [identities],
  );

  const share = async () => {
    if (mode === 'text') {
      if (!text.trim()) return;
      if (isApiEnabled && identity) {
        try {
          await publishContent.mutateAsync({
            format: 'story',
            mediaType: 'text',
            caption: text.trim(),
            visibility: audience === 'followers'
              ? 'followers'
              : audience === 'close_friends'
                ? 'friends'
                : 'community',
            identity,
          });
        } catch (error) {
          Alert.alert(
            'Could not share story',
            error instanceof Error ? error.message : 'Please try again.',
          );
          return;
        }
      }
      publishStory({
        type: 'text',
        textContent: text.trim(),
        backgroundColor: STORY_TEXT_BACKGROUNDS[bgIndex],
        audience,
      });
    } else if (mode === 'photo') {
      publishStory({
        type: 'photo',
        mediaUrl: STORY_SAMPLE_PHOTOS[photoIndex],
        audience,
      });
    } else {
      publishStory({
        type: 'video',
        mediaUrl: STORY_SAMPLE_PHOTOS[(photoIndex + 1) % STORY_SAMPLE_PHOTOS.length],
        audience,
      });
    }
    navigation.replace('StoryViewer', { authorId: 'user-me' });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + 100,
          gap: theme.spacing.lg,
        }}>
        <AppHeader title="Create Story" showBrand={false} showActions={false} />

        {identityPills.length > 1 ? (
          <View style={styles.identityPicker}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Publishing as</Text>
            <FilterPills
              activeId={identity?.id ?? ''}
              onChange={setIdentityId}
              pills={identityPills}
            />
          </View>
        ) : null}

        <View style={styles.modeGrid}>
          {MODES.map(m => (
            <PressableScale
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[
                styles.modeCard,
                {
                  borderColor:
                    mode === m.id ? theme.colors.primary : theme.colors.borderSoft,
                  backgroundColor:
                    mode === m.id ? theme.colors.primarySoft : theme.colors.surface,
                  borderRadius: theme.radius.lg,
                },
              ]}>
              <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
                {m.label}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {m.id === 'photo'
                  ? 'From gallery'
                  : m.id === 'video'
                    ? 'Camera or gallery'
                    : 'Type a moment'}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Card style={{ gap: 10 }}>
          {mode === 'text' ? (
            <>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Background
              </Text>
              <FilterPills
                activeId={String(bgIndex)}
                onChange={id => setBgIndex(Number(id))}
                pills={STORY_TEXT_BACKGROUNDS.map((_, i) => ({
                  id: String(i),
                  label: `Style ${i + 1}`,
                }))}
              />
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="What's happening?"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                style={[
                  styles.textInput,
                  {
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    backgroundColor: STORY_TEXT_BACKGROUNDS[bgIndex] + '22',
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Sample media (camera/gallery in next release)
              </Text>
              <FilterPills
                activeId={String(photoIndex)}
                onChange={id => setPhotoIndex(Number(id))}
                pills={STORY_SAMPLE_PHOTOS.map((_, i) => ({
                  id: String(i),
                  label: `Clip ${i + 1}`,
                }))}
              />
            </>
          )}

          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Audience
          </Text>
          <FilterPills
            activeId={audience}
            onChange={id => setAudience(id as StoryAudience)}
            pills={AUDIENCE}
          />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            Stories disappear after 24 hours and save to your private archive.
          </Text>
        </Card>
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
        <Button title="Share Story" icon="plus" onPress={() => void share()} loading={publishContent.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  identityPicker: { gap: 6 },
  modeGrid: { gap: 10 },
  modeCard: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  textInput: {
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
