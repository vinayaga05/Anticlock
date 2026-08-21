import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { ReelFeedScreen } from '@/features/reels/screens/ReelFeedScreen';
import { CreateScreen } from '@/features/create/screens/CreateScreen';
import { HealthScreen } from '@/features/health/screens/HealthScreen';
import { ShopScreen } from '@/features/shop/screens/ShopScreen';
import { MainTabParamList } from '@/shared/navigation/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';
import {
  CrossIcon,
  HeartBeatIcon,
  HomeIcon,
  ReelsIcon,
  ShopIcon,
} from '@/shared/components/Icons';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIconFrame({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.frame,
        {
          borderColor: theme.colors.tabIcon,
          backgroundColor: focused ? '#fff' : '#f4f4f4',
        },
      ]}>
      {children}
    </View>
  );
}

export function MainNavigator() {
  const theme = useTheme();
  const cartCount = useCartStore(s => s.count);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconFrame focused={focused}>
              <HomeIcon filled={focused} color={theme.colors.tabIcon} size={22} />
            </TabIconFrame>
          ),
        }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelFeedScreen}
        options={{
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ focused }) => (
            <TabIconFrame focused={focused}>
              <ReelsIcon filled={focused} color={theme.colors.tabIcon} size={22} />
            </TabIconFrame>
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconFrame focused={focused}>
              <CrossIcon color={theme.colors.tabIcon} size={22} />
            </TabIconFrame>
          ),
        }}
      />
      <Tab.Screen
        name="Health"
        component={HealthScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconFrame focused={focused}>
              <HeartBeatIcon color={theme.colors.tabIcon} size={22} />
            </TabIconFrame>
          ),
        }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconFrame focused={focused}>
              <View>
                <ShopIcon filled={focused} color={theme.colors.tabIcon} size={22} />
                {cartCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.like }]}>
                    <Text style={styles.badgeText}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TabIconFrame>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});
