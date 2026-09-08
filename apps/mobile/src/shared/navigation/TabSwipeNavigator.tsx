import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type {
  MainTabParamList,
  RootStackParamList,
} from '@/shared/navigation/types';

const TAB_ORDER: (keyof MainTabParamList)[] = [
  'PlayFeed',
  'Flash',
  'Needs',
  'Community',
  'Knock',
  'Shop',
];
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 0.35;

type Props = {
  activeTab: keyof MainTabParamList;
  children: React.ReactNode;
};

/**
 * Adds intentional horizontal navigation without intercepting vertical feed
 * scrolling. From Clips, the backward swipe opens a new Reel.
 */
export function TabSwipeNavigator({ activeTab, children }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation =
    navigation.getParent<NavigationProp<RootStackParamList>>();
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  const changeTab = React.useCallback(
    (direction: 'next' | 'previous') => {
      const current = activeTabRef.current;
      const currentIndex = TAB_ORDER.indexOf(current);

      if (direction === 'previous' && current === 'PlayFeed') {
        rootNavigation?.navigate('ClipComposer');
        return;
      }

      const targetIndex =
        direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      const target = TAB_ORDER[targetIndex];
      if (target) navigation.navigate(target);
    },
    [navigation, rootNavigation],
  );

  const tabSwipeGesture = React.useMemo(
    () =>
      Gesture.Pan()
        // A native horizontal recognizer coexists with each screen's vertical
        // ScrollView/FlatList without stealing vertical scrolling.
        .activeOffsetX([-12, 12])
        .failOffsetY([-22, 22])
        .onEnd(gesture => {
          const isSwipeLeft =
            gesture.translationX <= -SWIPE_DISTANCE ||
            gesture.velocityX <= -SWIPE_VELOCITY;
          const isSwipeRight =
            gesture.translationX >= SWIPE_DISTANCE ||
            gesture.velocityX >= SWIPE_VELOCITY;

          if (isSwipeLeft) runOnJS(changeTab)('next');
          if (isSwipeRight) runOnJS(changeTab)('previous');
        }),
    [changeTab],
  );

  return (
    <GestureDetector gesture={tabSwipeGesture}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
