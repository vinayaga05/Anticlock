import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FitnessLog, FitnessLogKind } from '@anticlock/contracts';
import { useFitnessMutation, useFitnessQuery } from '../api/fitnessApi';
import {
  fitnessDateValid,
  fitnessRange,
  logKinds,
  logTitle,
} from '../fitnessModel';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessField,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';

export function FitnessHistoryScreen() {
  const nav = useNavigation<any>();
  const [kind, setKind] = useState<FitnessLogKind>('workout');
  const [range, setRange] = useState(fitnessRange('month'));
  const query = useFitnessQuery<{ logs: FitnessLog[] }>(
    `/logs/${kind}?from=${range.from}&to=${range.to}`,
    fitnessDateValid(range.from) &&
      fitnessDateValid(range.to) &&
      range.from <= range.to,
  );
  const mutation = useFitnessMutation();
  const [error, setError] = useState('');
  function remove(log: FitnessLog) {
    Alert.alert(
      'Delete this private entry?',
      'This entry will be removed from your journal and progress totals.',
      [
        { text: 'Keep entry', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setError('');
              await mutation.mutateAsync({
                path: `/logs/${log.kind}/${log.id}`,
                method: 'DELETE',
              });
            } catch (e) {
              setError((e as Error).message);
            }
          },
        },
      ],
    );
  }
  return (
    <FitnessScreen
      busy={mutation.isPending}
      title="Your journal, over time"
      subtitle="Every entry below comes from your saved records."
    >
      <FitnessChoices
        label="Journal"
        options={logKinds}
        selected={kind}
        onChange={setKind}
      />
      <FitnessField
        label="From date"
        value={range.from}
        onChangeText={from => setRange(r => ({ ...r, from }))}
        placeholder="YYYY-MM-DD"
      />
      <FitnessField
        label="To date"
        value={range.to}
        onChangeText={to => setRange(r => ({ ...r, to }))}
        placeholder="YYYY-MM-DD"
      />
      {!fitnessDateValid(range.from) ||
      !fitnessDateValid(range.to) ||
      range.from > range.to ? (
        <FitnessNotice error message="Choose a valid date range." />
      ) : query.isPending ? (
        <FitnessLoading />
      ) : query.isError ? (
        <FitnessEmpty
          title="History could not be loaded"
          message={query.error.message}
          action="Retry"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : query.data?.logs.length ? (
        query.data.logs.map(log => (
          <FitnessCard key={log.id}>
            <FitnessSection
              title={logTitle(log)}
              caption={new Date(`${log.date}T12:00:00`).toLocaleDateString()}
            />
            {(log.data as any).notes && (
              <FitnessText muted>{(log.data as any).notes}</FitnessText>
            )}
            <FitnessAction
              label="Open or edit entry"
              secondary
              onPress={() =>
                nav.navigate(
                  log.kind === 'workout'
                    ? 'FitnessWorkout'
                    : log.kind === 'meal'
                    ? 'FitnessMeals'
                    : 'FitnessLog',
                  {
                    kind: log.kind,
                    date: log.date,
                    logId: log.id,
                    ...(log.kind === 'workout' ? { workoutId: log.id } : {}),
                  },
                )
              }
            />
            <FitnessAction
              label="Delete entry"
              destructive
              disabled={mutation.isPending}
              onPress={() => remove(log)}
            />
          </FitnessCard>
        ))
      ) : (
        <FitnessEmpty
          title="No entries in this period"
          message="Your saved entries will appear here as you build your rhythm."
        />
      )}
      <FitnessNotice error message={error} />
    </FitnessScreen>
  );
}
