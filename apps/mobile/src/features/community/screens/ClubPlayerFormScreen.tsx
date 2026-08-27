import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { FilterPills } from '@/shared/components/FilterPills';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  type ClubPlayerRole,
  useCommunityStore,
} from '@/shared/data/community';
import { RootStackParamList } from '@/shared/navigation/types';

const ROLE_PILLS: { id: ClubPlayerRole; label: string }[] = [
  { id: 'player', label: 'Player' },
  { id: 'coach', label: 'Coach' },
  { id: 'staff', label: 'Staff' },
];

export function ClubPlayerFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClubPlayerForm'>>();
  const { clubId, playerId } = route.params;

  const players = useCommunityStore(s => s.players);
  const existing = useMemo(
    () => (playerId ? players.find(p => p.id === playerId) : undefined),
    [players, playerId],
  );
  const club = useCommunityStore(s => s.getClub(clubId));
  const upsertPlayer = useCommunityStore(s => s.upsertPlayer);
  const removePlayer = useCommunityStore(s => s.removePlayer);

  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState<ClubPlayerRole>(existing?.role ?? 'player');
  const [position, setPosition] = useState(existing?.position ?? '');
  const [jerseyNumber, setJerseyNumber] = useState(
    existing?.jerseyNumber != null ? String(existing.jerseyNumber) : '',
  );
  const [ageGroup, setAgeGroup] = useState(existing?.ageGroup ?? '');
  const [skillLevel, setSkillLevel] = useState(existing?.skillLevel ?? '');
  const [isCaptain, setIsCaptain] = useState(existing?.isCaptain ?? false);

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      borderRadius: theme.radius.md,
    },
  ];

  if (!club) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Player" showBrand={false} showActions={false} />
        <EmptyState icon="user" title="Team not found" />
      </ScreenContainer>
    );
  }

  if (playerId && !existing) {
    return (
      <ScreenContainer tabAware={false}>
        <AppHeader title="Player" showBrand={false} showActions={false} />
        <EmptyState icon="user" title="Player not found" />
      </ScreenContainer>
    );
  }

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter the player name.');
      return;
    }
    const jersey =
      jerseyNumber.trim() === '' ? undefined : Number.parseInt(jerseyNumber, 10);
    if (jerseyNumber.trim() && Number.isNaN(jersey)) {
      Alert.alert('Invalid jersey', 'Jersey number must be a number.');
      return;
    }

    upsertPlayer(clubId, {
      id: existing?.id,
      name: name.trim(),
      role,
      position: position.trim() || undefined,
      jerseyNumber: jersey,
      ageGroup: ageGroup.trim() || undefined,
      skillLevel: skillLevel.trim() || undefined,
      isCaptain,
    });
    navigation.goBack();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Remove player', `Remove ${existing.name} from the roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePlayer(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader
        title={existing ? 'Edit player' : 'Add player'}
        showBrand={false}
        showActions={false}
      />

      <Card style={{ gap: 12 }}>
        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Player name"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <View style={{ gap: 6 }}>
          <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>
            Role
          </Text>
          <FilterPills
            activeId={role}
            onChange={id => setRole(id as ClubPlayerRole)}
            pills={ROLE_PILLS}
          />
        </View>

        <Field label="Position">
          <TextInput
            value={position}
            onChangeText={setPosition}
            placeholder="Forward, Distance…"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <Field label="Jersey number">
          <TextInput
            value={jerseyNumber}
            onChangeText={setJerseyNumber}
            placeholder="10"
            keyboardType="number-pad"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <Field label="Age group">
          <TextInput
            value={ageGroup}
            onChangeText={setAgeGroup}
            placeholder="18-24"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <Field label="Skill level">
          <TextInput
            value={skillLevel}
            onChangeText={setSkillLevel}
            placeholder="Intermediate"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <View style={styles.switchRow}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            Captain
          </Text>
          <Switch
            value={isCaptain}
            onValueChange={setIsCaptain}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primarySoft,
            }}
            thumbColor={isCaptain ? theme.colors.primary : theme.colors.surfaceMuted}
          />
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <Button title="Save" icon="check" onPress={onSave} />
        {existing ? (
          <Button title="Delete player" variant="destructive" onPress={onDelete} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
});
