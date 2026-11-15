import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { FitnessLog, FitnessLogKind } from '@anticlock/contracts';
import { useFitnessMutation, useFitnessQuery } from '../api/fitnessApi';
import {
  fitnessDateValid,
  fitnessRange,
  localFitnessDate,
  logKinds,
  logTitle,
} from '../fitnessModel';
import {
  FitnessDatePicker,
  FitnessDisclosure,
} from '../components/FitnessControls';
import { FitnessIllustration } from '../components/FitnessVisuals';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';
export function FitnessHistoryScreen() {
  const nav = useNavigation<any>(),
    [kind, setKind] = useState<FitnessLogKind>('workout'),
    [period, setPeriod] = useState('Month'),
    [range, setRange] = useState(fitnessRange('month')),
    [error, setError] = useState('');
  const valid =
    fitnessDateValid(range.from) &&
    fitnessDateValid(range.to) &&
    range.from <= range.to;
  const query = useFitnessQuery<{ logs: FitnessLog[] }>(
      `/logs/${kind}?from=${range.from}&to=${range.to}`,
      valid,
    ),
    mutation = useFitnessMutation();
  function open(log?: FitnessLog) {
    nav.navigate(
      (log?.kind ?? kind) === 'workout'
        ? 'FitnessWorkout'
        : (log?.kind ?? kind) === 'meal'
        ? 'FitnessMeals'
        : 'FitnessLog',
      {
        kind: log?.kind ?? kind,
        date: log?.date ?? localFitnessDate(),
        ...(log
          ? {
              logId: log.id,
              ...(log.kind === 'workout' ? { workoutId: log.id } : {}),
            }
          : {}),
      },
    );
  }
  function remove(log: FitnessLog) {
    Alert.alert(
      'Delete this entry?',
      'It will be removed from your private journal and progress totals.',
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
      title="Your journal"
      busy={mutation.isPending}
      footer={<FitnessAction label="Log an entry" onPress={() => open()} />}
    >
      <FitnessChoices
        label="Entry type"
        options={logKinds}
        selected={kind}
        onChange={setKind}
      />
      <FitnessChoices
        label="Period"
        options={['Week', 'Month', 'Custom']}
        selected={period}
        onChange={v => {
          setPeriod(v);
          if (v !== 'Custom')
            setRange(fitnessRange(v === 'Week' ? 'week' : 'month'));
        }}
      />
      {period === 'Custom' && (
        <FitnessCard>
          <FitnessDatePicker
            label="From"
            value={range.from}
            onChange={from => setRange(r => ({ ...r, from }))}
            maximumDate={range.to}
          />
          <FitnessDatePicker
            label="To"
            value={range.to}
            onChange={to => setRange(r => ({ ...r, to }))}
            minimumDate={range.from}
            maximumDate={new Date()}
          />
        </FitnessCard>
      )}
      {!valid ? (
        <FitnessNotice
          error
          message="Choose an end date after the start date."
        />
      ) : query.isPending ? (
        <FitnessLoading />
      ) : query.isError ? (
        <FitnessEmpty
          title="Journal unavailable"
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
              caption={new Date(`${log.date}T12:00:00`).toLocaleDateString(
                undefined,
                { weekday: 'short', month: 'short', day: 'numeric' },
              )}
            />
            <FitnessAction
              label="Open entry"
              secondary
              onPress={() => open(log)}
            />
            <FitnessDisclosure title="Entry options">
              {(log.data as any).notes && (
                <FitnessText muted>{(log.data as any).notes}</FitnessText>
              )}
              <FitnessAction
                label="Delete entry"
                destructive
                disabled={mutation.isPending}
                onPress={() => remove(log)}
              />
            </FitnessDisclosure>
          </FitnessCard>
        ))
      ) : (
        <>
          <FitnessIllustration kind="empty" />
          <FitnessEmpty
            title="A fresh page"
            message="Your saved entries will appear here."
          />
        </>
      )}
      <FitnessNotice error message={error} />
    </FitnessScreen>
  );
}
