import React, { useState, useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Channel, MessageList, MessageComposer } from 'stream-chat-react-native';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { conversations, messages as seedMessages } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { Message } from '@/shared/types';
import { FlatList, TextInput } from 'react-native';
import { IconButton } from '@/shared/components/IconButton';
import { AppIcon } from '@/shared/components/AppIcon';

export function ThreadScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Thread'>>();
  const { client, isReady } = useStreamChat();
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mock state for fallback
  const conversation = conversations.find(c => c.id === route.params.conversationId);
  const [items, setItems] = useState<Message[]>(
    seedMessages.filter(m => m.conversationId === route.params.conversationId),
  );
  const [draft, setDraft] = useState('');

  const profileMembers = channel?.data?.profile_members as Array<{ user_id?: string; profile_id?: string; name?: string; image?: string | null; profile_type?: 'personal' | 'business' }> | undefined;
  const peerProfile = profileMembers?.find(member => member.user_id !== client?.userID);
  const ownProfile = profileMembers?.find(member => member.user_id === client?.userID);
  const title = route.params.profile?.displayName ?? peerProfile?.name ?? conversation?.name ?? 'Chat';
  const avatarUrl = route.params.profile?.avatarUrl ?? peerProfile?.image ?? null;
  const profileType = route.params.profile?.type ?? peerProfile?.profile_type;

  // Load Stream channel if available
  useEffect(() => {
    if (!client || !isReady) {
      setLoading(false);
      return;
    }

    const loadChannel = async () => {
      try {
        const channelId = route.params.channelId || route.params.conversationId;
        const channelType = route.params.channelType || 'messaging';
        
        const ch = client.channel(channelType, channelId);
        await ch.watch();
        setChannel(ch);
      } catch (error) {
        console.error('Failed to load channel:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChannel();
  }, [client, isReady, route.params.channelId, route.params.conversationId]);

  const send = () => {
    if (!draft.trim()) return;
    setItems(prev => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversationId: route.params.conversationId || '',
        text: draft.trim(),
        fromMe: true,
        time: 'Now',
      },
    ]);
    setDraft('');
  };

  // Show loading state while connecting
  if (loading && client && isReady) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading conversation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use Stream Chat if available
  if (client && isReady && channel) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}>
        <View style={[styles.chatHeader, { borderBottomColor: theme.colors.borderSoft }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.chatAvatar} />
          ) : (
            <View style={[styles.chatAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
              <AppIcon name={profileType === 'business' ? 'shop' : 'profile'} size={19} color={theme.colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[theme.typography.section, { color: theme.colors.textPrimary }]}>{title}</Text>
            {profileType ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{profileType === 'business' ? 'Business profile' : 'Personal profile'}{ownProfile?.name ? ` · As ${ownProfile.name}` : ''}</Text> : null}
          </View>
          {route.params.profile?.verified || peerProfile?.profile_type === 'business' ? <AppIcon name="verified" size={16} color={theme.colors.primary} /> : null}
        </View>
        <Channel channel={channel}>
          <MessageList />
          <MessageComposer />
        </Channel>
      </SafeAreaView>
    );
  }

  // Mock fallback
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}>
      <Text
        style={[
          theme.typography.section,
          { color: theme.colors.textPrimary, paddingHorizontal: 16, paddingTop: 8 },
        ]}>
        {title}
      </Text>
      <Text style={[styles.mockBanner, { color: theme.colors.textTertiary, backgroundColor: theme.colors.surfaceMuted }]}>
        Using mock data (API disabled)
      </Text>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              {
                alignSelf: item.fromMe ? 'flex-end' : 'flex-start',
                backgroundColor: item.fromMe
                  ? theme.colors.primary
                  : theme.colors.surface,
                borderRadius: theme.radius.lg,
              },
            ]}>
            <Text
              style={[
                theme.typography.body,
                { color: item.fromMe ? '#042F2E' : theme.colors.textPrimary },
              ]}>
              {item.text}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                {
                  color: item.fromMe ? 'rgba(4,47,46,0.7)' : theme.colors.textTertiary,
                  marginTop: 4,
                },
              ]}>
              {item.time}
            </Text>
          </View>
        )}
      />
      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.xl,
          },
        ]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={theme.colors.textTertiary}
          style={[theme.typography.body, { flex: 1, color: theme.colors.textPrimary, paddingVertical: 8 }]}
        />
        <IconButton
          name="send"
          accessibilityLabel="Send message"
          onPress={send}
          color={theme.colors.primary}
          glass={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chatHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  chatAvatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  mockBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 12,
  },
  bubble: {
    maxWidth: '80%',
    padding: 14,
  },
  composer: {
    flexDirection: 'row',
    gap: 4,
    margin: 12,
    paddingLeft: 14,
    paddingRight: 4,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
