import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import { useAssistantChat } from '@/features/assistant/hooks/useAssistantChat';
import { MessageThread } from '@/features/assistant/components/MessageThread';
import { VoiceInput } from '@/features/assistant/components/VoiceInput';
import { ToolProgressBanner } from '@/features/assistant/components/ToolProgressBanner';
import { QuickSuggestions } from '@/features/assistant/components/QuickSuggestions';
import {
  executeAssistantNavigation,
  resultCardToNavigation,
} from '@/features/assistant/navigation/assistantNavigation';
import type { AssistantResultCard } from '@/features/assistant/types';
import { isApiEnabled } from '@/shared/api/client';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SPRING = { damping: 22, stiffness: 220, mass: 0.85 };

export function AssistantBottomSheetHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const open = useAssistantStore(s => s.open);
  const voiceMode = useAssistantStore(s => s.voiceMode);
  const closeAssistant = useAssistantStore(s => s.closeAssistant);
  const messages = useAssistantStore(s => s.messages);
  const toolProgress = useAssistantStore(s => s.toolProgress);
  const quickActions = useAssistantStore(s => s.quickActions);
  const sending = useAssistantStore(s => s.sending);
  const conversationId = useAssistantStore(s => s.conversationId);
  const { sendMessage, interrupt, flushOfflineQueue } = useAssistantChat(navigation);
  const [draft, setDraft] = useState('');

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    translateY.value = open
      ? withSpring(0, SPRING)
      : withTiming(SCREEN_HEIGHT, { duration: 220 });
  }, [open, translateY]);

  useEffect(() => {
    if (open && isApiEnabled) {
      void flushOfflineQueue();
    }
  }, [flushOfflineQueue, open]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    paddingBottom: Math.max(insets.bottom, keyboard.height.value > 0 ? 8 : 16),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: open ? withTiming(0.45, { duration: 200 }) : withTiming(0, { duration: 200 }),
  }));

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(e => {
          if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd(e => {
          if (e.translationY > 120 || e.velocityY > 900) {
            runOnJS(closeAssistant)();
          } else {
            translateY.value = withSpring(0, SPRING);
          }
        }),
    [closeAssistant, translateY],
  );

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    void sendMessage(text);
    Keyboard.dismiss();
  };

  const handleQuickAction = (action: string) => {
    void sendMessage(action);
  };

  const handleCardPress = (card: AssistantResultCard, rank: number) => {
    const nav = resultCardToNavigation(card);
    if (nav) executeAssistantNavigation(navigation, nav.route, nav.params);
    if (conversationId) {
      void import('@/shared/api/client').then(({ apiRequest }) =>
        apiRequest('/v1/assistant/analytics', {
          method: 'POST',
          body: JSON.stringify({
            conversationId,
            event: { type: 'result_clicked', resultType: card.type, rank },
          }),
        }),
      );
    }
  };

  if (!open) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      />
      <PressableScale
        style={StyleSheet.absoluteFill}
        onPress={closeAssistant}
        accessibilityLabel="Close Genie"
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderColor: theme.colors.borderSoft,
              maxHeight: SCREEN_HEIGHT * 0.82,
              paddingTop: insets.top > 0 ? 8 : 12,
            },
            sheetStyle,
          ]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AppIcon name="sparkles" size={18} color={theme.colors.primary} />
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                Genie
              </Text>
            </View>
            <PressableScale onPress={closeAssistant} accessibilityLabel="Close">
              <AppIcon name="x" size={22} color={theme.colors.textSecondary} />
            </PressableScale>
          </View>

          {toolProgress ? (
            <View style={styles.progressWrap}>
              <ToolProgressBanner
                toolName={toolProgress.toolName}
                message={toolProgress.message}
              />
            </View>
          ) : null}

          <MessageThread messages={messages} onPressCard={handleCardPress} />

          <View style={styles.footer}>
            <QuickSuggestions actions={quickActions} onSelect={handleQuickAction} />
            <VoiceInput
              value={draft}
              onChangeText={setDraft}
              onSubmit={handleSubmit}
              onStop={interrupt}
              sending={sending}
              sheetOpen={open}
              autoStartListening={voiceMode}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 16 },
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressWrap: {
    paddingHorizontal: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
});
