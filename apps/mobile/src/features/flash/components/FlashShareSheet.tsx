import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { conversations } from '@/shared/data/mocks';

type Props = {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onSendKnock?: () => void;
};

export function FlashShareSheet({ postId, visible, onClose, onSendKnock }: Props) {
  const theme = useTheme();
  const shareContent = useEngagementStore(s => s.shareContent);
  const [quote, setQuote] = useState('');

  const link = useMemo(() => `https://anticlock.app/flash/${postId}`, [postId]);

  const close = () => {
    setQuote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
            },
          ]}
          onPress={e => e.stopPropagation()}>
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
            Share
          </Text>
          <TextInput
            value={quote}
            onChangeText={setQuote}
            placeholder="Add a thought (optional)"
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
              },
            ]}
            multiline
          />
          {(
            [
              {
                key: 'flash',
                label: 'Share to Flash',
                onPress: () => {
                  shareContent(postId, { toFlash: true, quote });
                  close();
                },
              },
              {
                key: 'community',
                label: 'Share to a Community',
                onPress: () => {
                  Alert.alert('Coming soon', 'Community share will land in a later pass.');
                  close();
                },
              },
              {
                key: 'knock',
                label: 'Send through Knock',
                onPress: () => {
                  shareContent(postId);
                  onSendKnock?.();
                  close();
                },
              },
              {
                key: 'native',
                label: 'Share externally',
                onPress: async () => {
                  shareContent(postId);
                  await Share.share({ message: quote ? `${quote}\n${link}` : link });
                  close();
                },
              },
              {
                key: 'copy',
                label: 'Copy link',
                onPress: async () => {
                  shareContent(postId);
                  await Share.share({ message: link });
                  close();
                },
              },
            ] as const
          ).map(action => (
            <PressableScale
              key={action.key}
              onPress={action.onPress}
              style={[
                styles.row,
                {
                  borderColor: theme.colors.borderSoft,
                  borderRadius: theme.radius.md,
                },
              ]}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
                {action.label}
              </Text>
            </PressableScale>
          ))}
          {conversations[0] ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              Knock will open {conversations[0].name}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    padding: 20,
    gap: 10,
    paddingBottom: 36,
  },
  input: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    textAlignVertical: 'top',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
