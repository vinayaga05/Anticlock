import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useUnreadCount } from '@/shared/api/notificationHooks';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';

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
  const [bookingSearch, setBookingSearch] = useState('');
  const { data: unreadData } = useUnreadCount();
  const { client, isReady } = useStreamChat();
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    if (!client || !isReady) {
      setChatUnread(0);
      return;
    }
    const refresh = (event?: { total_unread_count?: number }) => {
      const fromEvent = event?.total_unread_count;
      const fromUser = (client.user as { total_unread_count?: number } | undefined)
        ?.total_unread_count;
      setChatUnread(fromEvent ?? fromUser ?? 0);
    };
    refresh();
    const listeners = [
      client.on('message.new', refresh),
      client.on('message.read', refresh),
      client.on('notification.mark_read', refresh),
      client.on('connection.recovered', refresh),
    ];
    return () => listeners.forEach(listener => listener.unsubscribe());
  }, [client, isReady]);

  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (initialTab) {
      setTab(initialTab);
    }
  }, [route.params?.initialTab]);

  return (
    <ScreenContainer contentStyle={styles.content}>
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
              style={StyleSheet.flatten([
                styles.segment,
                active ? {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.md,
                  ...theme.shadows.soft,
                } : {},
              ])}>
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
              {item.id === 'notifications' && (unreadData?.unreadCount ?? 0) > 0 ? (
                <TabBadge count={unreadData!.unreadCount} />
              ) : null}
              {item.id === 'chat' && chatUnread > 0 ? <TabBadge count={chatUnread} /> : null}
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.panel}>
        <ScrollView
          style={tab === 'notifications' ? styles.visiblePanel : styles.hidden}
          contentContainerStyle={styles.scrollPanel}
          showsVerticalScrollIndicator={false}>
          <KnockNotificationsList />
        </ScrollView>
        <ScrollView
          style={tab === 'bookings' ? styles.visiblePanel : styles.hidden}
          contentContainerStyle={styles.scrollPanel}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <SearchBar
            value={bookingSearch}
            onChangeText={setBookingSearch}
            placeholder="Search providers, services, or classes..."
            emphasized
            showVoiceControls
            compact
          />
          <KnockBookingsList searchQuery={bookingSearch} />
        </ScrollView>
        <View style={tab === 'chat' ? styles.chatContent : styles.hidden}>
          <KnockChatList />
        </View>
      </View>
    </ScreenContainer>
  );
}

function TabBadge({ count }: { count: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.tabBadge, { backgroundColor: theme.colors.primary }]}>
      <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
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
    flexDirection: 'row',
    gap: 5,
  },
  segmentLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  panel: {
    marginTop: 4,
    flex: 1,
  },
  content: { flex: 1 },
  visiblePanel: { flex: 1 },
  scrollPanel: { gap: 16, paddingBottom: 24 },
  hidden: { display: 'none' },
  chatContent: { flex: 1 },
  tabBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
