import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Channel, MessageComposer, MessageList } from 'stream-chat-react-native';
import type { Channel as StreamChannel } from 'stream-chat';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { IconButton } from '@/shared/components/IconButton';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { blockProfile } from '@/shared/api/profileFollows';
import { reportConversation, type PublisherRef } from '@/shared/api/messagesClient';

type ProfileMember = {
  user_id?: string;
  profile_id?: string;
  name?: string;
  image?: string | null;
  profile_type?: 'personal' | 'business';
};

function membersOf(channel: StreamChannel | null) {
  return ((channel?.data as any)?.profile_members ?? []) as ProfileMember[];
}

export function ThreadScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Thread'>>();
  const { client, isReady, isConnecting } = useStreamChat();
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let listener: { unsubscribe: () => void } | undefined;
    if (!client || !isReady) {
      setLoading(isConnecting);
      return;
    }
    const loadChannel = async () => {
      setLoading(true);
      setError(null);
      try {
        const channelId = route.params.channelId || route.params.conversationId;
        const ch = client.channel(route.params.channelType || 'messaging', channelId);
        await ch.watch();
        if ((ch.data as any)?.frozen) throw new Error('This conversation is unavailable.');
        if (cancelled) return;
        setChannel(ch);
        listener = ch.on('channel.updated', event => {
          if ((event.channel as any)?.frozen) setError('This conversation is no longer available.');
        });
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this conversation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadChannel();
    return () => {
      cancelled = true;
      listener?.unsubscribe();
    };
  }, [client, isReady, isConnecting, route.params.channelId, route.params.channelType, route.params.conversationId, retry]);

  const profileMembers = membersOf(channel);
  const peerProfile = profileMembers.find(member => member.user_id !== client?.userID);
  const ownProfile = profileMembers.find(member => member.user_id === client?.userID);
  const title = route.params.profile?.displayName ?? peerProfile?.name ?? 'Chat';
  const avatarUrl = route.params.profile?.avatarUrl ?? peerProfile?.image ?? null;
  const profileType = route.params.profile?.type ?? peerProfile?.profile_type;
  const peerRef: PublisherRef | null = peerProfile?.profile_id && peerProfile.profile_type
    ? { id: peerProfile.profile_id, type: peerProfile.profile_type }
    : route.params.profile ? { id: route.params.profile.id, type: route.params.profile.type } : null;
  const ownRef: PublisherRef | null = ownProfile?.profile_id && ownProfile.profile_type
    ? { id: ownProfile.profile_id, type: ownProfile.profile_type }
    : null;

  const clearForMe = useCallback(async () => {
    if (!channel || !client?.userID) return;
    try {
      await channel.hide(client.userID, true);
      navigation.goBack();
    } catch {
      Alert.alert('Couldn’t clear chat', 'Please try again.');
    }
  }, [channel, client?.userID, navigation]);

  const sendReport = useCallback(async (reason: 'spam' | 'harassment' | 'impersonation' | 'unsafe' | 'other') => {
    if (!channel?.id || !ownRef || !peerRef) return;
    try {
      await reportConversation(channel.id, ownRef, peerRef, reason);
      Alert.alert('Report sent', 'Thanks. Our safety team can now review this conversation.');
    } catch (cause) {
      Alert.alert('Couldn’t send report', cause instanceof Error ? cause.message : 'Please try again.');
    }
  }, [channel?.id, ownRef?.id, ownRef?.type, peerRef?.id, peerRef?.type]);

  const chooseReportReason = () => Alert.alert('Report conversation', 'What is the main issue?', [
    { text: 'Spam', onPress: () => void sendReport('spam') },
    { text: 'Harassment', onPress: () => void sendReport('harassment') },
    { text: 'Impersonation', onPress: () => void sendReport('impersonation') },
    { text: 'Unsafe content', onPress: () => void sendReport('unsafe') },
    { text: 'Other', onPress: () => void sendReport('other') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const confirmBlock = () => {
    if (!ownRef || !peerRef) return;
    Alert.alert(`Block ${title}?`, 'They will no longer be able to see or continue this chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockProfile(ownRef, peerRef);
            navigation.goBack();
          } catch (cause) {
            Alert.alert('Couldn’t block profile', cause instanceof Error ? cause.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const openActions = () => Alert.alert(title, undefined, [
    { text: 'Report conversation', onPress: chooseReportReason },
    { text: 'Clear chat for me', style: 'destructive', onPress: () => void clearForMe() },
    ...(ownRef && peerRef ? [{ text: 'Block profile', style: 'destructive' as const, onPress: confirmBlock }] : []),
    { text: 'Cancel', style: 'cancel' },
  ]);

  if (loading || (!isReady && isConnecting)) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>Loading conversation…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!client || !isReady || !channel || error) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <AppIcon name="messages" size={34} color={theme.colors.textTertiary} />
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>Chat unavailable</Text>
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>{error ?? 'Reconnect to load this conversation.'}</Text>
          <PressableScale style={[styles.retryButton, { backgroundColor: theme.colors.primary }]} onPress={() => setRetry(value => value + 1)}>
            <Text style={styles.retryText}>Try again</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <View style={[styles.chatHeader, { borderBottomColor: theme.colors.borderSoft }]}>
        <PressableScale
          style={styles.profileAction}
          disabled={!peerRef}
          onPress={() => peerRef && navigation.navigate('Profile', { profileId: peerRef.id, profileType: peerRef.type })}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.chatAvatar} />
          ) : (
            <View style={[styles.chatAvatar, styles.avatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
              <AppIcon name={profileType === 'business' ? 'shop' : 'profile'} size={19} color={theme.colors.primary} />
            </View>
          )}
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[theme.typography.section, { color: theme.colors.textPrimary }]}>{title}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {profileType === 'business' ? 'Business profile' : 'Direct message'}{ownProfile?.name ? ` · As ${ownProfile.name}` : ''}
            </Text>
          </View>
        </PressableScale>
        <IconButton name="more" accessibilityLabel="Conversation actions" onPress={openActions} glass={false} />
      </View>
      <Channel channel={channel} markReadOnMount>
        <MessageList />
        <MessageComposer />
      </Channel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chatHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  profileAction: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileText: { flex: 1, minWidth: 0 },
  chatAvatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  statusText: { fontSize: 14, textAlign: 'center' },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: '#fff', fontWeight: '700' },
});
