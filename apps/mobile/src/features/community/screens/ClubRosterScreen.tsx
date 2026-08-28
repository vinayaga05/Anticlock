import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { PlayerRow } from '@/features/community/components/ClubChallengeCards';
import { useCommunityStore } from '@/shared/data/community';
import { RootStackParamList } from '@/shared/navigation/types';

export function ClubRosterScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'TeamRoster'>>();
  const { teamId } = route.params;

  const team = useCommunityStore(s => s.getTeam(teamId));
  const players = useCommunityStore(useShallow(s => s.getPlayersForTeam(teamId)));
  const isAdmin = useCommunityStore(s => s.isTeamAdmin(teamId));

  if (!team) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Roster" showBrand={false} showActions={false} />
        <EmptyState icon="users" title="Team not found" />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenContainer scrollable tabAware={false} contentStyle={{ gap: 10 }}>
        <AppHeader title={`${team.name} roster`} showBrand={false} showActions={false} />

        {players.length === 0 ? (
          <EmptyState
            icon="users"
            title="No players yet"
            description={isAdmin ? 'Add your first player to the roster.' : undefined}
          />
        ) : (
          players.map(player => (
            <PlayerRow
              key={player.id}
              player={player}
              onPress={() =>
                navigation.navigate('TeamPlayerForm', {
                  teamId,
                  playerId: player.id,
                })
              }
            />
          ))
        )}

        {isAdmin ? (
          <Button
            title="Add player"
            icon="plus"
            onPress={() => navigation.navigate('TeamPlayerForm', { teamId })}
          />
        ) : null}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
