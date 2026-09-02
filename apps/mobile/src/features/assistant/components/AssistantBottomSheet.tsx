import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Extrapolation,
  interpolate,
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
import { isApiEnabled } from '@/shared/api/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_GAP = 10;
/** Default detent — roughly Control Center’s mid-open height. */
const DEFAULT_VISIBLE = 0.62;

const SPRING = { damping: 26, stiffness: 280, mass: 0.82 };
const RUBBER = 0.55;

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
  const [sheetMounted, setSheetMounted] = useState(false);
  const dismissingRef = React.useRef(false);

  const expandedY = insets.top + TOP_GAP;
  const closedY = SCREEN_HEIGHT;
  const defaultY = expandedY + (1 - DEFAULT_VISIBLE) * (closedY - expandedY);
  const sheetHeight = closedY - expandedY;

  const translateY = useSharedValue(closedY);
  const backdrop = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const dragStartY = useSharedValue(defaultY);
  const snapAtDragStart = useSharedValue(0);
  const lastTranslationY = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();
  const nativeGesture = useMemo(() => Gesture.Native(), []);

  const finishClose = useCallback(() => {
    setSheetMounted(false);
    setDraft('');
    if (useAssistantStore.getState().open) {
      closeAssistant();
    }
  }, [closeAssistant]);

  const snapToDefault = useCallback(() => {
    translateY.value = withSpring(defaultY, SPRING);
    backdrop.value = withSpring(0.45, SPRING);
  }, [backdrop, defaultY, translateY]);

  const snapToExpanded = useCallback(() => {
    translateY.value = withSpring(expandedY, SPRING);
    backdrop.value = withSpring(0.55, SPRING);
  }, [backdrop, expandedY, translateY]);

  const dismissSheet = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(closedY, { duration: 260 }, finished => {
      if (finished) runOnJS(finishClose)();
    });
    backdrop.value = withTiming(0, { duration: 240 });
  }, [backdrop, closedY, finishClose, translateY]);

  const settleAfterDrag = useCallback(
    (y: number, dy: number, velocityY: number, fromExpanded: boolean) => {
      const visibleAtStart = closedY - (fromExpanded ? expandedY : defaultY);
      const dismissDistance = visibleAtStart * 0.28;

      // Fast flick up → expand
      if (velocityY < -700) {
        snapToExpanded();
        return;
      }

      // Fast flick down → collapse or dismiss
      if (velocityY > 1100) {
        if (fromExpanded) snapToDefault();
        else dismissSheet();
        return;
      }

      if (!fromExpanded && dy > dismissDistance) {
        dismissSheet();
        return;
      }

      if (fromExpanded && dy > (defaultY - expandedY) * 0.35) {
        if (dy > defaultY - expandedY + dismissDistance * 0.5) {
          dismissSheet();
        } else {
          snapToDefault();
        }
        return;
      }

      const mid = (expandedY + defaultY) / 2;
      const dismissGate = defaultY + (closedY - defaultY) * 0.25;
      if (y >= dismissGate) dismissSheet();
      else if (y < mid) snapToExpanded();
      else snapToDefault();
    },
    [closedY, defaultY, dismissSheet, expandedY, snapToDefault, snapToExpanded],
  );

  useEffect(() => {
    if (open) {
      dismissingRef.current = false;
      setSheetMounted(true);
      translateY.value = closedY;
      backdrop.value = 0;
      const id = requestAnimationFrame(() => {
        translateY.value = withSpring(defaultY, SPRING);
        backdrop.value = withSpring(0.45, SPRING);
      });
      return () => cancelAnimationFrame(id);
    }
    if (sheetMounted && !dismissingRef.current) {
      dismissSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && isApiEnabled) {
      void flushOfflineQueue();
    }
  }, [flushOfflineQueue, open]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const show = Keyboard.addListener(showEvt, () => {
      if (translateY.value > expandedY + 40) {
        translateY.value = withSpring(expandedY, SPRING);
        backdrop.value = withSpring(0.55, SPRING);
      }
    });
    return () => show.remove();
  }, [backdrop, expandedY, translateY]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const endDrag = (y: number, dy: number, velocityY: number, fromExpanded: boolean) => {
    settleAfterDrag(y, dy, velocityY, fromExpanded);
  };

  const clampWithRubber = (raw: number) => {
    'worklet';
    if (raw < expandedY) {
      const overshoot = expandedY - raw;
      return expandedY - overshoot * RUBBER;
    }
    if (raw > closedY) {
      const overshoot = raw - closedY;
      return closedY + overshoot * RUBBER;
    }
    return raw;
  };

  const listPan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
      snapAtDragStart.value = translateY.value < (expandedY + defaultY) / 2 ? 1 : 0;
      lastTranslationY.value = 0;
      runOnJS(dismissKeyboard)();
    })
    .onUpdate(e => {
      const changeY = e.translationY - lastTranslationY.value;
      lastTranslationY.value = e.translationY;
      const scrollingList = scrollOffset.value > 1;
      const pullingDown = changeY > 0;
      const pullingUp = changeY < 0;

      // Let the message list scroll when content is scrolled and user pulls down
      if (scrollingList && pullingDown) {
        dragStartY.value = translateY.value - e.translationY;
        return;
      }

      // At expanded + pulling up → don't drag the sheet further
      if (pullingUp && translateY.value <= expandedY + 0.5) {
        dragStartY.value = translateY.value - e.translationY;
        return;
      }

      translateY.value = clampWithRubber(dragStartY.value + e.translationY);
      const progress = 1 - (translateY.value - expandedY) / (closedY - expandedY);
      backdrop.value = Math.max(0, Math.min(0.55, progress * 0.55));
    })
    .onEnd(e => {
      runOnJS(endDrag)(
        translateY.value,
        translateY.value - dragStartY.value,
        e.velocityY,
        snapAtDragStart.value === 1,
      );
    })
    .simultaneousWithExternalGesture(nativeGesture);

  const headerPan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
      snapAtDragStart.value = translateY.value < (expandedY + defaultY) / 2 ? 1 : 0;
      runOnJS(dismissKeyboard)();
    })
    .onUpdate(e => {
      translateY.value = clampWithRubber(dragStartY.value + e.translationY);
      const progress = 1 - (translateY.value - expandedY) / (closedY - expandedY);
      backdrop.value = Math.max(0, Math.min(0.55, progress * 0.55));
    })
    .onEnd(e => {
      runOnJS(endDrag)(
        translateY.value,
        translateY.value - dragStartY.value,
        e.velocityY,
        snapAtDragStart.value === 1,
      );
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const keyboardPadStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, 8) + keyboard.height.value,
  }));

  const handleGrabStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [expandedY, defaultY, closedY],
      [0.45, 1, 1],
      Extrapolation.CLAMP,
    ),
  }));

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

  if (!sheetMounted) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <GestureDetector
          gesture={Gesture.Tap().onEnd(() => {
            runOnJS(dismissSheet)();
          })}>
          <Animated.View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: theme.colors.backgroundElevated,
            borderColor: theme.colors.borderSoft,
          },
          sheetStyle,
        ]}>
        <GestureDetector gesture={headerPan}>
          <View>
            <View style={styles.handleWrap}>
              <Animated.View
                style={[
                  styles.handle,
                  { backgroundColor: theme.colors.border },
                  handleGrabStyle,
                ]}
              />
            </View>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <AppIcon name="sparkles" size={18} color={theme.colors.primary} />
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                  Genie
                </Text>
              </View>
              <PressableScale onPress={dismissSheet} accessibilityLabel="Close">
                <AppIcon name="x" size={22} color={theme.colors.textSecondary} />
              </PressableScale>
            </View>
          </View>
        </GestureDetector>

        {toolProgress ? (
          <View style={styles.progressWrap}>
            <ToolProgressBanner
              toolName={toolProgress.toolName}
              message={toolProgress.message}
            />
          </View>
        ) : null}

        <GestureDetector gesture={listPan}>
          <Animated.View style={styles.listWrap}>
            <MessageThread
              messages={messages}
              onPressCard={handleCardPress}
              nativeGesture={nativeGesture}
              onScrollOffsetChange={y => {
                scrollOffset.value = y;
              }}
            />
          </Animated.View>
        </GestureDetector>

        <Animated.View style={[styles.footer, keyboardPadStyle]}>
          <QuickSuggestions actions={quickActions} onSelect={handleQuickAction} />
          <VoiceInput
            value={draft}
            onChangeText={setDraft}
            onSubmit={handleSubmit}
            onStop={interrupt}
            sending={sending}
            sheetOpen={open || sheetMounted}
            autoStartListening={voiceMode}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'column',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
      },
      android: { elevation: 18 },
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
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
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
});
