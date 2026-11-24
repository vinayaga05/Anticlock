import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { ProfileConnectionsPage } from '@anticlock/contracts';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { navigateToProfile } from '@/shared/navigation/businessNavigation';
import type { RootStackParamList } from '@/shared/navigation/types';
import {
  followProfile,
  unfollowProfile,
  reconcileSocialState,
  useProfileConnections,
  usePagedFollowRequests,
  useFollowRequestAction,
  useRemoveFollower,
  type ProfileRef,
} from '@/shared/api/profileFollows';
import { useQueryClient } from '@tanstack/react-query';

type Connection = ProfileConnectionsPage['items'][number];
export function ProfileConnectionsScreen() {
  const { params } =
    useRoute<RouteProp<RootStackParamList, 'ProfileConnections'>>();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const cache = useQueryClient();
  const { active } = useActiveProfile();
  const viewer = active
    ? { id: active.id, type: identityProfileType(active) }
    : null;
  const target = { id: params.profileId, type: params.profileType };
  const [direction, setDirection] = useState(params.direction);
  useEffect(() => {
    setDirection(params.direction);
  }, [params.profileId, params.profileType, params.direction]);
  const list = useProfileConnections(target, viewer, direction);
  const owner = list.data?.pages[0]?.isOwner === true;
  const requests = usePagedFollowRequests(
    owner && direction === 'followers' ? target : null,
  );
  const pendingRequests = useMemo(
    () => [
      ...new Map(
        (requests.data?.pages.flatMap(page => page.items) ?? []).map(item => [
          item.id,
          item,
        ]),
      ).values(),
    ],
    [requests.data],
  );
  const requestAction = useFollowRequestAction(target);
  const remove = useRemoveFollower(target);
  const busyKeys = useRef(new Set<string>());
  const [busy, setBusy] = useState<string[]>([]);
  const scope = `${target.type}:${target.id}:${viewer?.type}:${viewer?.id}:${direction}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(
    () => () => {
      currentScope.current = '';
    },
    [],
  );
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages.flatMap(page => page.items) ?? []).filter(item => {
      const key = `${item.profile.type}:${item.profile.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [list.data]);
  useFocusEffect(
    useCallback(() => {
      void list.refetch();
      if (owner && direction === 'followers') void requests.refetch();
    }, [scope, owner, list.refetch, requests.refetch]),
  );

  const run = async (key: string, action: () => Promise<unknown>) => {
    if (busyKeys.current.has(key)) return;
    busyKeys.current.add(key);
    setBusy([...busyKeys.current]);
    const started = currentScope.current;
    try {
      await action();
    } catch (error) {
      if (started === currentScope.current)
        Alert.alert(
          'Could not update connection',
          error instanceof Error ? error.message : 'Please try again.',
        );
    } finally {
      busyKeys.current.delete(key);
      setBusy([...busyKeys.current]);
    }
  };
  const identity = (profile: Connection['profile']) => (
    <PressableScale
      style={styles.identity}
      accessibilityLabel={`Open ${profile.displayName} profile`}
      onPress={() => navigateToProfile(navigation, profile)}
    >
      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.fallback,
            { backgroundColor: theme.colors.primarySoft },
          ]}
        >
          <Text style={{ color: theme.colors.primary }}>
            {profile.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.name}>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.textPrimary, fontWeight: '700' }}
        >
          {profile.displayName}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.colors.textSecondary }}>
          {profile.handle
            ? `@${profile.handle}`
            : profile.type === 'business'
            ? 'Business profile'
            : 'Personal profile'}
        </Text>
      </View>
    </PressableScale>
  );
  const renderConnection = ({ item }: { item: Connection }) => {
    const { profile, relationship } = item;
    const key = `${profile.type}:${profile.id}`;
    const isSelf = viewer?.id === profile.id && viewer.type === profile.type;
    const label = relationship.isRequested
      ? 'Requested'
      : relationship.isFollowing
      ? 'Following'
      : 'Follow';
    return (
      <View
        style={[styles.row, { borderBottomColor: theme.colors.borderSoft }]}
      >
        {identity(profile)}
        {!isSelf ? (
          <Button
            title={label}
            variant={
              relationship.isFollowing || relationship.isRequested
                ? 'secondary'
                : 'primary'
            }
            disabled={!relationship.canFollow || busy.includes(key)}
            loading={busy.includes(key)}
            onPress={() =>
              void run(key, async () => {
                if (!viewer) return;
                if (relationship.isFollowing || relationship.isRequested)
                  await unfollowProfile(viewer, profile);
                else await followProfile(viewer, profile);
                await reconcileSocialState(cache);
              })
            }
          />
        ) : null}
        {item.canRemove ? (
          <Button
            title="Remove"
            variant="ghost"
            disabled={busy.includes(key)}
            onPress={() =>
              Alert.alert(
                'Remove follower?',
                `${profile.displayName} will need to follow again to regain follower access.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () =>
                      void run(key, () => remove.mutateAsync(profile)),
                  },
                ],
              )
            }
          />
        ) : null}
      </View>
    );
  };
  const header = (
    <>
      {owner && direction === 'followers' && requests.isError ? (
        <View style={styles.section}>
          <Text style={{ color: theme.colors.error }}>
            Could not load follow requests.
          </Text>
          <Button
            title="Retry requests"
            onPress={() => void requests.refetch()}
          />
        </View>
      ) : null}
      {owner && direction === 'followers' && requests.isLoading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : null}
      {owner &&
      direction === 'followers' &&
      (pendingRequests.length > 0 || requests.hasNextPage) ? (
        <View style={styles.section}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
            Follow requests (
            {list.data?.pages[0]?.counts?.pendingRequests ??
              pendingRequests.length}
            )
          </Text>
          {pendingRequests.map(request => {
            const key = `request:${request.follower.type}:${request.follower.id}`;
            return (
              <View key={key} style={styles.row}>
                {identity({
                  ...request.follower,
                  handle: request.follower.handle ?? null,
                  businessCategory: null,
                })}
                <Button
                  title="Accept"
                  disabled={busy.includes(key)}
                  onPress={() =>
                    void run(key, () =>
                      requestAction.mutateAsync({
                        action: 'accept',
                        follower: request.follower,
                      }),
                    )
                  }
                />
                <Button
                  title="Decline"
                  variant="ghost"
                  disabled={busy.includes(key)}
                  onPress={() =>
                    void run(key, () =>
                      requestAction.mutateAsync({
                        action: 'reject',
                        follower: request.follower,
                      }),
                    )
                  }
                />
              </View>
            );
          })}
          {requests.hasNextPage ? (
            <Button
              title={
                requests.isFetchingNextPage
                  ? 'Loading requests…'
                  : 'More requests'
              }
              disabled={requests.isFetchingNextPage}
              onPress={() => void requests.fetchNextPage()}
            />
          ) : null}
          {requests.isFetchNextPageError ? (
            <Button
              title="Retry more requests"
              onPress={() => void requests.fetchNextPage()}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );
  return (
    <ScreenContainer
      padded={false}
      tabAware={false}
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={{ flex: 1 }}
    >
      <View style={styles.section}>
        <PressableScale
          accessibilityLabel="Back"
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigateToProfile(navigation, target);
          }}
          style={{
            alignSelf: 'flex-start',
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 18 }}>
            ‹ Back
          </Text>
        </PressableScale>
        <AppHeader
          title={params.displayName ?? 'Connections'}
          showBrand={false}
          showActions={false}
        />
        <FilterPills
          pills={[
            { id: 'followers', label: 'Followers' },
            { id: 'following', label: 'Following' },
          ]}
          activeId={direction}
          onChange={id => setDirection(id as typeof direction)}
        />
      </View>
      {!viewer ? (
        <Text style={styles.section}>Sign in to view connections.</Text>
      ) : list.isError && (!list.data || !list.isFetchNextPageError) ? (
        <View style={styles.section}>
          <Text style={{ color: theme.colors.textSecondary }}>
            {list.error instanceof Error
              ? list.error.message
              : 'Could not load connections.'}
          </Text>
          <Button title="Retry" onPress={() => void list.refetch()} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => `${item.profile.type}:${item.profile.id}`}
          renderItem={renderConnection}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshing={list.isRefetching && !list.isFetchingNextPage}
          onRefresh={() => {
            void list.refetch();
            if (owner) void requests.refetch();
          }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetching) void list.fetchNextPage();
          }}
          ListEmptyComponent={
            <View style={styles.section}>
              {list.isLoading ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text style={{ color: theme.colors.textSecondary }}>
                  {direction === 'followers'
                    ? 'No followers yet.'
                    : 'Not following anyone yet.'}
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : list.isFetchNextPageError ? (
              <Button
                title="Retry loading more"
                onPress={() => void list.fetchNextPage()}
              />
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 140,
    minHeight: 48,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, gap: 4 },
});
