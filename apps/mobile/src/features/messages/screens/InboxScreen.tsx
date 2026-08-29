import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { KnockBookingsList } from '@/features/messages/components/KnockBookingsList';
import { KnockChatList } from '@/features/messages/components/KnockChatList';
import { KnockNotificationsList } from '@/features/messages/components/KnockNotificationsList';
import type { KnockTab, MainTabParamList } from '@/shared/navigation/types';

const TABS: { id: KnockTab; label: string }[] = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'chat', label: 'Chat' },
];

export function InboxScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Knock'>>();
  const [tab, setTab] = useState<KnockTab>('bookings');

  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (initialTab) {
      setTab(initialTab);
    }
  }, [route.params?.initialTab]);

  return (
    <ScreenContainer scrollable>
      <AppHeader
        title="Knock"
        onNotificationsPress={() => setTab('notifications')}
        onMessagesPress={() => setTab('chat')}
        onSettingsPress={() => navigation.navigate('AccountSettings')}
      />

      <View
        style={[
          styles.segmentRow,
          { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg },
        ]}>
        {TABS.map(item => {
          const active = tab === item.id;
          return (
            <PressableScale
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[
                styles.segment,
                active && {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.md,
                  ...theme.shadows.soft,
                },
              ]}>
              <Text
                style={[
                  styles.segmentLabel,
                  {
                    color: active ? theme.colors.textPrimary : theme.colors.textSecondary,
                    fontWeight: active ? '700' : '600',
                  },
                ]}>
                {item.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {tab === 'bookings' ? (
        <SearchBar
          placeholder="Search doctors, technicians, or classes..."
          emphasized
          showVoiceControls
          compact
        />
      ) : null}

      <View style={styles.panel}>
        {tab === 'notifications' ? <KnockNotificationsList /> : null}
        {tab === 'bookings' ? <KnockBookingsList /> : null}
        {tab === 'chat' ? <KnockChatList /> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 6,
  },
  segmentLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  panel: {
    marginTop: 4,
  },
});
