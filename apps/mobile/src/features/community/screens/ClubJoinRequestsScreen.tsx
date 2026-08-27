import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCommunityStore } from '@/shared/data/community';
import { RootStackParamList } from '@/shared/navigation/types';

export function ClubJoinRequestsScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'ClubJoinRequests'>>();
  const { clubId } = route.params;

  const club = useCommunityStore(s => s.getClub(clubId));
  const joinRequests = useCommunityStore(s => s.joinRequests);
  const resolveJoinRequest = useCommunityStore(s => s.resolveJoinRequest);

  const pending = useMemo(
    () => joinRequests.filter(r => r.clubId === clubId && r.status === 'pending'),
    [joinRequests, clubId],
  );

  if (!club) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Join requests" showBrand={false} showActions={false} />
        <EmptyState icon="users" title="Team not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 12 }}>
      <AppHeader title="Join requests" showBrand={false} showActions={false} />
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
        Pending requests for {club.name}
      </Text>

      {pending.length === 0 ? (
        <EmptyState icon="check" title="No pending requests" />
      ) : (
        pending.map(req => (
          <Card key={req.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textPrimary, fontWeight: '700' },
                ]}>
                {req.userName}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                Requested {req.requestedAt}
              </Text>
            </View>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reject"
                  variant="ghost"
                  onPress={() => resolveJoinRequest(req.id, false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Accept"
                  onPress={() => resolveJoinRequest(req.id, true)}
                />
              </View>
            </View>
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
});
