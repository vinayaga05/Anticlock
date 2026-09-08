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
import { TabSwipeNavigator } from '@/shared/navigation/TabSwipeNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

function PlayFeedTab() {
  return (
    <TabSwipeNavigator activeTab="PlayFeed">
      <ReelFeedScreen />
    </TabSwipeNavigator>
  );
}

function FlashTab() {
  return (
    <TabSwipeNavigator activeTab="Flash">
      <FlashFeedScreen />
    </TabSwipeNavigator>
  );
}

function NeedsTab() {
  return (
    <TabSwipeNavigator activeTab="Needs">
      <NeedsScreen />
    </TabSwipeNavigator>
  );
}

function CommunityTab() {
  return (
    <TabSwipeNavigator activeTab="Community">
      <CommunitiesScreen />
    </TabSwipeNavigator>
  );
}

function KnockTab() {
  return (
    <TabSwipeNavigator activeTab="Knock">
      <InboxScreen />
    </TabSwipeNavigator>
  );
}

function ShopTab() {
  return (
    <TabSwipeNavigator activeTab="Shop">
      <ShopScreen />
    </TabSwipeNavigator>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <FloatingPillTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Floating pill overlays content; screens pad themselves via tabBarInset.
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tab.Screen
        name="PlayFeed"
        component={PlayFeedTab}
        options={{ tabBarAccessibilityLabel: 'Clips' }}
      />
      <Tab.Screen
        name="Flash"
        component={FlashTab}
        options={{ tabBarAccessibilityLabel: 'Flash' }}
      />
      <Tab.Screen
        name="Needs"
        component={NeedsTab}
        options={{ tabBarAccessibilityLabel: 'Needs' }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityTab}
        options={{ tabBarAccessibilityLabel: 'Nexus' }}
      />
      <Tab.Screen
        name="Knock"
        component={KnockTab}
        options={{ tabBarAccessibilityLabel: 'Knock' }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopTab}
        options={{ tabBarAccessibilityLabel: 'Shop' }}
      />
    </Tab.Navigator>
  );
}
