import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  useSpeechRecognition,
  type VoiceInputState,
} from '@/features/assistant/hooks/useSpeechRecognition';

export function VoiceInput({
  value,
  onChangeText,
  onSubmit,
  onStop,
  sending,
  sheetOpen = true,
  autoStartListening = false,
  onVoiceStateChange,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  sending: boolean;
  sheetOpen?: boolean;
  autoStartListening?: boolean;
  onVoiceStateChange?: (state: VoiceInputState) => void;
}) {
  const theme = useTheme();
  const autoStartedRef = useRef(false);
  const pulse = useSharedValue(1);

  const speech = useSpeechRecognition({
    onTranscriptChange: onChangeText,
    onStateChange: onVoiceStateChange,
    sending,
  });

  const {
    available,
    listening,
    isConfirm,
    state,
    errorMessage,
    startListening,
    stopListening,
    cancelListening,
    dismissConfirm,
    reset,
    openSettings,
  } = speech;

  useEffect(() => {
    if (!sheetOpen) {
      autoStartedRef.current = false;
      void reset();
      return;
    }
    if (autoStartListening && sheetOpen && !autoStartedRef.current && available) {
      autoStartedRef.current = true;
      void startListening();
    }
  }, [autoStartListening, available, reset, sheetOpen, startListening]);

  useEffect(() => {
    if (listening) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 450 }), withTiming(1, { duration: 450 })),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 150 });
    }
  }, [listening, pulse]);

  const micPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handleMicPress = async () => {
    if (!available) return;
    if (listening) {
      await stopListening(true);
      return;
    }
    if (isConfirm) {
      dismissConfirm();
    }
    await startListening();
  };

  const handleSendChip = () => {
    if (!value.trim() || sending) return;
    onSubmit();
    dismissConfirm();
  };

  const showBanner =
    state === 'error' || state === 'permission_denied' || state === 'unavailable';

  return (
    <View style={styles.wrap}>
      {listening ? (
        <View style={styles.statusRow}>
          <Text
            maxFontSizeMultiplier={1.4}
            style={[styles.live, { color: theme.colors.primary }]}>
            Listening… {value.trim() || 'speak now'}
          </Text>
          <PressableScale
            accessibilityLabel="Cancel voice input"
            onPress={() => void cancelListening()}
            style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </PressableScale>
        </View>
      ) : null}

      {isConfirm && value.trim() ? (
        <PressableScale
          accessibilityLabel="Send to Genie"
          onPress={handleSendChip}
          style={[styles.sendChip, { backgroundColor: theme.colors.primarySoft }]}>
          <AppIcon name="send" size={14} color={theme.colors.primary} />
          <Text style={[styles.sendChipText, { color: theme.colors.primary }]}>
            Send to Genie
          </Text>
        </PressableScale>
      ) : null}

      {sending ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.live, { color: theme.colors.textSecondary }]}>Thinking…</Text>
        </View>
      ) : null}

      {showBanner && errorMessage ? (
        <View style={[styles.banner, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Text style={[styles.bannerText, { color: theme.colors.textSecondary }]}>
            {errorMessage}
          </Text>
          {state === 'permission_denied' ? (
            <PressableScale onPress={() => void openSettings()}>
              <Text style={[styles.bannerAction, { color: theme.colors.primary }]}>
                Open Settings
              </Text>
            </PressableScale>
          ) : (
            <PressableScale onPress={() => void startListening()}>
              <Text style={[styles.bannerAction, { color: theme.colors.primary }]}>
                Try again
              </Text>
            </PressableScale>
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: listening ? theme.colors.primary : theme.colors.borderSoft,
          },
        ]}>
        <TextInput
          value={value}
          onChangeText={text => {
            if (isConfirm) dismissConfirm();
            onChangeText(text);
          }}
          placeholder="Ask Genie anything…"
          placeholderTextColor={theme.colors.textTertiary}
          style={[styles.input, { color: theme.colors.textPrimary }]}
          editable={!sending && !listening}
          onSubmitEditing={onSubmit}
          returnKeyType="send"
          maxFontSizeMultiplier={1.4}
        />
        <PressableScale
          accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
          onPress={() => void handleMicPress()}
          style={[styles.iconBtn, !available && styles.iconBtnDisabled]}
          disabled={!available || sending}>
          <Animated.View style={micPulseStyle}>
            <AppIcon
              name="mic"
              size={20}
              color={
                !available
                  ? theme.colors.textTertiary
                  : listening
                    ? theme.colors.error
                    : theme.colors.primary
              }
            />
          </Animated.View>
        </PressableScale>
        {sending ? (
          <PressableScale accessibilityLabel="Stop" onPress={onStop} style={styles.iconBtn}>
            <AppIcon name="x" size={20} color={theme.colors.textSecondary} />
          </PressableScale>
        ) : (
          <PressableScale accessibilityLabel="Send" onPress={onSubmit} style={styles.iconBtn}>
            <AppIcon name="send" size={20} color={theme.colors.primary} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
  },
  live: {
    flex: 1,
    fontSize: 12,
  },
  cancelBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sendChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  sendChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  banner: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  bannerText: {
    fontSize: 12,
    lineHeight: 16,
  },
  bannerAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  bar: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  iconBtn: {
    padding: 4,
  },
  iconBtnDisabled: {
    opacity: 0.45,
  },
});
