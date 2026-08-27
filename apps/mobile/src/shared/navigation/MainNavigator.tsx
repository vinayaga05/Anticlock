import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ReelFeedScreen } from '@/features/reels/screens/ReelFeedScreen';
import { FlashFeedScreen } from '@/features/flash/screens/FlashFeedScreen';
import { NeedsScreen } from '@/features/needs/screens/NeedsScreen';
import { CommunitiesScreen } from '@/features/community/screens/CommunitiesScreen';
import { InboxScreen } from '@/features/messages/screens/InboxScreen';
import { ShopScreen } from '@/features/shop/screens/ShopScreen';
import { MainTabParamList } from '@/shared/navigation/types';
import { FloatingPillTabBar } from '@/shared/navigation/FloatingPillTabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingPillTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen
        name="Play"
        component={ReelFeedScreen}
        options={{ tabBarAccessibilityLabel: 'Play' }}
      />
      <Tab.Screen
        name="Flash"
        component={FlashFeedScreen}
        options={{ tabBarAccessibilityLabel: 'Flash' }}
      />
      <Tab.Screen
        name="Needs"
        component={NeedsScreen}
        options={{ tabBarAccessibilityLabel: 'Needs' }}
      />
      <Tab.Screen
        name="Community"
        component={CommunitiesScreen}
        options={{ tabBarAccessibilityLabel: 'Community' }}
      />
      <Tab.Screen
        name="Knock"
        component={InboxScreen}
        options={{ tabBarAccessibilityLabel: 'Knock' }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ tabBarAccessibilityLabel: 'Shop' }}
      />
    </Tab.Navigator>
  );
}
