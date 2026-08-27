import React, { PropsWithChildren } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PropsWithChildren<{
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  accessibilityLabel?: string;
  scaleTo?: number;
}>;

export function PressableScale({
  children,
  onPress,
  onLongPress,
  delayLongPress,
  style,
  disabled,
  accessibilityLabel,
  scaleTo,
}: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const target = scaleTo ?? theme.motion.pressScale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => {
        scale.value = withTiming(target, { duration: theme.motion.fast });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: theme.motion.fast });
      }}
      style={[animatedStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}
