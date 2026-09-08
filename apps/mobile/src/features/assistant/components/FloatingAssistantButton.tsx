import React from 'react';
import {
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import { STORAGE_KEYS } from '@/shared/constants';
import { storage } from '@/shared/services/storage';

const BUTTON_SIZE = 52;
const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 88;
const DRAG_HOLD_MS = 260;

type Position = { x: number; y: number };
type PositionRatio = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadSavedPosition(): PositionRatio | null {
  const raw = storage.getString(STORAGE_KEYS.ASSISTANT_BUTTON_POSITION);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PositionRatio>;
    if (
      typeof value.x !== 'number' ||
      typeof value.y !== 'number' ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y)
    ) {
      return null;
    }
    return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1) };
  } catch {
    return null;
  }
}

function boundsFor(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
) {
  return {
    minX: 8,
    maxX: Math.max(8, width - BUTTON_SIZE - 8),
    minY: Math.max(8, topInset + 8),
    maxY: Math.max(8, height - BUTTON_SIZE - Math.max(bottomInset, 8)),
  };
}

function positionFromSaved(
  saved: PositionRatio | null,
  bounds: ReturnType<typeof boundsFor>,
): Position {
  if (!saved) {
    return {
      x: clamp(bounds.maxX - (DEFAULT_RIGHT - 8), bounds.minX, bounds.maxX),
      y: clamp(bounds.maxY - (DEFAULT_BOTTOM - 8), bounds.minY, bounds.maxY),
    };
  }
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) * saved.x,
    y: bounds.minY + (bounds.maxY - bounds.minY) * saved.y,
  };
}

export function FloatingAssistantButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const enabled = useAssistantStore(s => s.enabled);
  const open = useAssistantStore(s => s.open);
  const openAssistant = useAssistantStore(s => s.openAssistant);
  const savedPosition = React.useRef(loadSavedPosition()).current;
  const bounds = React.useMemo(
    () => boundsFor(width, height, insets.top, insets.bottom),
    [height, insets.bottom, insets.top, width],
  );
  const [position, setPosition] = React.useState<Position>(() =>
    positionFromSaved(savedPosition, bounds),
  );
  const positionRef = React.useRef(position);
  const dragStarted = React.useRef(false);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosition = React.useRef(position);

  const setClampedPosition = React.useCallback(
    (next: Position) => {
      const clamped = {
        x: clamp(next.x, bounds.minX, bounds.maxX),
        y: clamp(next.y, bounds.minY, bounds.maxY),
      };
      positionRef.current = clamped;
      setPosition(clamped);
    },
    [bounds],
  );

  React.useEffect(() => {
    setClampedPosition(positionRef.current);
  }, [setClampedPosition]);

  const clearHoldTimer = React.useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  React.useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const persistPosition = React.useCallback(() => {
    const { x, y } = positionRef.current;
    const xRange = Math.max(1, bounds.maxX - bounds.minX);
    const yRange = Math.max(1, bounds.maxY - bounds.minY);
    storage.set(
      STORAGE_KEYS.ASSISTANT_BUTTON_POSITION,
      JSON.stringify({
        x: (x - bounds.minX) / xRange,
        y: (y - bounds.minY) / yRange,
      }),
    );
  }, [bounds]);

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStarted.current = false;
          startPosition.current = positionRef.current;
          clearHoldTimer();
          holdTimer.current = setTimeout(() => {
            dragStarted.current = true;
          }, DRAG_HOLD_MS);
        },
        onPanResponderMove: (_event, gesture) => {
          if (!dragStarted.current) return;
          setClampedPosition({
            x: startPosition.current.x + gesture.dx,
            y: startPosition.current.y + gesture.dy,
          });
        },
        onPanResponderRelease: () => {
          clearHoldTimer();
          if (dragStarted.current) {
            persistPosition();
          } else {
            openAssistant();
          }
          dragStarted.current = false;
        },
        onPanResponderTerminate: () => {
          clearHoldTimer();
          dragStarted.current = false;
        },
      }),
    [clearHoldTimer, openAssistant, persistPosition, setClampedPosition],
  );

  if (!enabled || open) return null;

  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityHint="Long press and drag to move Genie."
      accessibilityLabel="Open Genie"
      onAccessibilityTap={() => openAssistant()}
      style={[
        styles.wrap,
        {
          left: position.x,
          top: position.y,
          backgroundColor: theme.colors.primary,
          ...theme.shadows.float,
        },
      ]}
    >
      <AppIcon name="sparkles" size={22} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 120,
    elevation: 120,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
