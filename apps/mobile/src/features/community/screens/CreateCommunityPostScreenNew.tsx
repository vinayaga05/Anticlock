import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCreatePostMutation } from '@/shared/api';

export function CreateCommunityPostScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { communityId } = route.params;
  const [content, setContent] = useState('');
  const createMutation = useCreatePostMutation();

  const handleCreate = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for your post.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        communityId,
        request: { content: content.trim() },
      });
      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create post. Please try again.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}>
          <AppHeader title="Create Post" showBack onBack={() => navigation.goBack()} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.padded, { gap: 20, paddingVertical: 16 }]}>
          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
              What's on your mind?
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share something with the community..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              numberOfLines={10}
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

          <Button
            title="Post"
            onPress={handleCreate}
            disabled={createMutation.isPending || !content.trim()}
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
    minHeight: 200,
    textAlignVertical: 'top',
  },
});
