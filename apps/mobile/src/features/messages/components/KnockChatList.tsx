import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Channel, LocalMessage, MessageResponse } from 'stream-chat';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { EmptyState } from '@/shared/components/EmptyState';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';

type ProfileMember = {
  user_id?: string;
  profile_id?: string;
  profile_type?: 'personal' | 'business';
  name?: string;
  image?: string | null;
};

const PAGE_SIZE = 30;

function profileMembers(channel: Channel) {
  return ((channel.data as any)?.profile_members ?? []) as ProfileMember[];
}

function lastMessage(channel: Channel) {
  const items = channel.state.messages as Array<LocalMessage | MessageResponse>;
  return items[items.length - 1];
}

function formatTime(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function deliveryState(channel: Channel, message: LocalMessage | MessageResponse | undefined, peerUserId?: string) {
  if (!message || message.user?.id !== channel.getClient().userID) return null;
  if ((message as LocalMessage).status === 'sending') return '◷';
  const lastRead = peerUserId ? channel.state.read[peerUserId]?.last_read : null;
  const sentAt = message.created_at ? new Date(message.created_at) : null;
  return lastRead && sentAt && new Date(lastRead).getTime() >= sentAt.getTime() ? '✓✓' : '✓';
}

export function KnockChatList() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { client, isReady, isConnecting, error, retry } = useStreamChat();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const mounted = useRef(true);
  const channelCount = useRef(0);

  useEffect(() => { channelCount.current = channels.length; }, [channels.length]);

  const filters = useMemo(() => ({
    type: 'messaging',
    members: { $in: [user?.id ?? ''] },
    frozen: false,
  }), [user?.id]);

  const loadFirstPage = useCallback(async () => {
    if (!client || !isReady || !user?.id) return;
    setLoading(true);
    try {
      const result = await client.queryChannels(
        filters,
        [{ last_message_at: -1 }],
        { limit: Math.max(PAGE_SIZE, channelCount.current), state: true, watch: true },
      );
      if (!mounted.current) return;
      setChannels(result);
      setHasMore(result.length >= PAGE_SIZE);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [client, isReady, user?.id, filters]);

  const loadMore = useCallback(async () => {
    if (!client || !isReady || !user?.id || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await client.queryChannels(
        filters,
        [{ last_message_at: -1 }],
        { limit: PAGE_SIZE, offset: channels.length, state: true, watch: true },
      );
      if (!mounted.current) return;
      setChannels(current => {
        const known = new Set(current.map(item => item.cid));
        return [...current, ...result.filter(item => !known.has(item.cid))];
      });
      setHasMore(result.length === PAGE_SIZE);
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [client, isReady, user?.id, hasMore, loadingMore, filters, channels.length]);

  useEffect(() => {
    mounted.current = true;
    void loadFirstPage();
    if (!client || !isReady) return () => { mounted.current = false; };
    const refresh = () => { void loadFirstPage(); };
    const listeners = [
      client.on('message.new', refresh),
      client.on('message.read', refresh),
      client.on('channel.updated', refresh),
      client.on('channel.hidden', refresh),
      client.on('notification.added_to_channel', refresh),
      client.on('notification.removed_from_channel', refresh),
      client.on('connection.recovered', refresh),
    ];
    return () => {
      mounted.current = false;
      listeners.forEach(listener => listener.unsubscribe());
    };
  }, [client, isReady, loadFirstPage]);

  if (!client || !isReady) {
    if (isConnecting) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>Connecting to chat…</Text>
        </View>
      );
    }
    return (
      <EmptyState
        icon="messages"
        title="Chat unavailable"
        description={error ? 'We could not connect to your conversations. Please try again.' : 'Sign in to load your conversations.'}
        actionLabel={error ? 'Retry' : undefined}
        onAction={error ? retry : undefined}
      />
    );
  }

  if (loading && channels.length === 0) {
    return <View style={styles.centerContainer}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <FlatList
      data={channels}
      keyExtractor={item => item.cid}
      contentContainerStyle={channels.length === 0 ? styles.emptyList : styles.list}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={<EmptyState icon="messages" title="No messages" description="Follow someone—or accept their follow—to start chatting." />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
      renderItem={({ item: channel }) => {
        const members = profileMembers(channel);
        const peer = members.find(member => member.user_id !== client.userID);
        const own = members.find(member => member.user_id === client.userID);
        const message = lastMessage(channel);
        const unread = channel.countUnread();
        const delivered = deliveryState(channel, message, peer?.user_id);
        const title = peer?.name ?? 'Conversation';
        const time = formatTime(message?.created_at ?? (channel.data as any)?.last_message_at);
        const preview = message?.text?.trim() || (message?.type === 'system' ? 'You are now connected' : 'New message');
        return (
          <PressableScale
            accessibilityLabel={`Open chat with ${title}`}
            style={[styles.row, { borderBottomColor: theme.colors.borderSoft }]}
            onPress={() => navigation.navigate('Thread', {
              conversationId: channel.id,
              channelId: channel.id,
              profile: peer?.profile_id && peer.profile_type ? {
                id: peer.profile_id,
                type: peer.profile_type,
                displayName: title,
                avatarUrl: peer.image ?? null,
                verified: false,
              } : undefined,
            })}>
            {peer?.image ? (
              <Image source={{ uri: peer.image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
                <AppIcon name={peer?.profile_type === 'business' ? 'shop' : 'profile'} size={21} color={theme.colors.primary} />
              </View>
            )}
            <View style={styles.body}>
              <View style={styles.top}>
                <Text numberOfLines={1} style={[styles.name, { color: theme.colors.textPrimary }]}>{title}</Text>
                <Text style={[styles.time, { color: unread > 0 ? theme.colors.primary : theme.colors.textTertiary }]}>{time}</Text>
              </View>
              <View style={styles.previewRow}>
                {delivered ? <Text style={[styles.delivery, { color: delivered === '✓✓' ? theme.colors.primary : theme.colors.textTertiary }]}>{delivered}</Text> : null}
                <Text numberOfLines={1} style={[styles.preview, { color: unread > 0 ? theme.colors.textPrimary : theme.colors.textSecondary }]}>{preview}</Text>
                {own?.name && own.profile_type === 'business' ? <Text style={[styles.asLabel, { color: theme.colors.textTertiary }]}>as {own.name}</Text> : null}
                {unread > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  centerContainer: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  statusText: { fontSize: 14, textAlign: 'center' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flex: 1 },
  time: { fontSize: 12, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  preview: { fontSize: 14, flex: 1 },
  delivery: { fontSize: 13, fontWeight: '800' },
  asLabel: { fontSize: 10, maxWidth: 70 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
