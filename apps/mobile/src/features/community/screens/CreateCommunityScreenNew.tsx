import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCreateCommunityMutation } from '@/shared/api';

export function CreateCommunityScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const createMutation = useCreateCommunityMutation();

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert('Error', 'Please provide a name and slug for your community.');
      return;
    }

    try {
      const community = await createMutation.mutateAsync({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      Alert.alert('Success', 'Community created successfully!');
      navigation.replace('CommunityDetail', { communityId: community.id });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create community. Please try again.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}>
          <AppHeader
            title="Create Community"
            showBack
            onBack={() => navigation.goBack()}
          />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.padded, { gap: 20, paddingVertical: 16 }]}>
          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
              Name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Chennai Cricket Fans"
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.textPrimary,
                },
              ]}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
              Slug *
            </Text>
            <TextInput
              value={slug}
              onChangeText={(text) => setSlug(text.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g., chennai-cricket-fans"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.textPrimary,
                },
              ]}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Used in the community URL. Only lowercase letters, numbers, and hyphens.
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your community..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              numberOfLines={4}
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.textPrimary,
                },
              ]}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
              Tags
            </Text>
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="e.g., Cricket, Sports, Chennai"
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.textPrimary,
                },
              ]}
            />
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Separate multiple tags with commas.
            </Text>
          </View>

          <Button
            title="Create Community"
            onPress={handleCreate}
            disabled={createMutation.isPending || !name.trim() || !slug.trim()}
          />
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  input: {
    padding: 12,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
