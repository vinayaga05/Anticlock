import React, { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { FitnessLog, FitnessLogKind } from '@anticlock/contracts';
import {
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import { fitnessDateValid, localFitnessDate, logTitle } from '../fitnessModel';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessField,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../components/FitnessUI';

const titles = {
  water: 'A moment to hydrate',
  weight: 'A check in, not a judgement',
  sleep: 'Rest is part of the plan',
  steps: 'Every step belongs',
  habit: 'Build your everyday rhythm',
};
export function FitnessLogScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const kind = (route.params?.kind ?? 'water') as Exclude<
    FitnessLogKind,
    'workout' | 'meal'
  >;
  const [date, setDate] = useState(route.params?.date ?? localFitnessDate());
  const id = route.params?.logId;
  const query = useFitnessQuery<{ logs: FitnessLog[] }>(
    `/logs/${kind}?from=${date}&to=${date}`,
    fitnessDateValid(date),
  );
  const existing = useFitnessQuery<{ log: FitnessLog }>(
    `/logs/${kind}/${id ?? ''}`,
    Boolean(id),
  );
  const mutation = useFitnessMutation<any>();
  const [value, setValue] = useState('');
  const [waist, setWaist] = useState('');
  const [quality, setQuality] = useState('good');
  const [habitKey, setHabitKey] = useState('');
  const [done, setDone] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(newFitnessRequestId());
  const signature = useRef('');
  const hydrated = useRef(false);
  useEffect(() => {
    if (existing.data && !hydrated.current) {
      const log = existing.data.log;
      const data = log.data as any;
      setDate(log.date);
      setValue(
        String(
          data.amountMl ??
            data.weightKg ??
            data.durationMinutes ??
            data.count ??
            '',
        ),
      );
      setWaist(data.waistCm ? String(data.waistCm) : '');
      setQuality(data.quality ?? 'good');
      setHabitKey(data.key ?? '');
      setDone(data.completed ?? true);
      setNotes(data.notes ?? '');
      hydrated.current = true;
    }
  }, [existing.data]);
  async function save() {
    setError('');
    setNotice('');
    try {
      if (!fitnessDateValid(date))
        throw new Error('Enter a valid date in YYYY-MM-DD format.');
      const n = Number(value);
      if (
        kind !== 'habit' &&
        (value.trim() === '' || !Number.isFinite(n) || n < 0)
      )
        throw new Error('Enter a valid, nonnegative number.');
      const data =
        kind === 'water'
          ? { amountMl: n, notes }
          : kind === 'weight'
          ? { weightKg: n, ...(waist ? { waistCm: Number(waist) } : {}), notes }
          : kind === 'sleep'
          ? { durationMinutes: n, quality, notes }
          : kind === 'steps'
          ? { count: n, notes }
          : { key: habitKey.trim(), completed: done, notes };
      const nextSignature = JSON.stringify({ date, data });
      if (signature.current && signature.current !== nextSignature)
        requestId.current = newFitnessRequestId();
      signature.current = nextSignature;
      await mutation.mutateAsync({
        path: id ? `/logs/${kind}/${id}` : `/logs/${kind}`,
        method: id ? 'PATCH' : 'POST',
        body: id
          ? { data }
          : { date, clientRequestId: requestId.current, data },
      });
      if (id) setNotice('Your entry was updated.');
      else {
        setValue('');
        setNotes('');
        setWaist('');
        requestId.current = newFitnessRequestId();
        signature.current = '';
        setNotice('Your entry was saved.');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <FitnessScreen
      busy={mutation.isPending}
      title={titles[kind] ?? 'Your daily check in'}
      subtitle="Record what happened. Your private entries are always yours to edit or delete."
    >
      {id && existing.isPending ? (
        <FitnessLoading />
      ) : id && existing.isError ? (
        <>
          <FitnessNotice error message={existing.error.message} />
          <FitnessAction
            label="Retry entry"
            onPress={() => {
              void existing.refetch();
            }}
          />
        </>
      ) : (
        <>
          <FitnessField
            label="Entry date"
            placeholder="YYYY-MM-DD"
            value={date}
            editable={!id}
            onChangeText={setDate}
          />
          {kind === 'habit' ? (
            <>
              <FitnessField
                label="Habit name"
                value={habitKey}
                onChangeText={setHabitKey}
                placeholder="e.g. Evening walk"
              />
              <FitnessChoices
                label="How did it go?"
                options={['Done', 'Not today']}
                selected={done ? 'Done' : 'Not today'}
                onChange={v => setDone(v === 'Done')}
              />
            </>
          ) : (
            <FitnessField
              label={
                kind === 'water'
                  ? 'Water (ml)'
                  : kind === 'weight'
                  ? 'Weight (kg)'
                  : kind === 'sleep'
                  ? 'Sleep duration (minutes)'
                  : 'Steps since your last entry'
              }
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              hint={
                kind === 'steps'
                  ? 'Entries add together. Enter only the steps you have not already logged today.'
                  : kind === 'sleep'
                  ? 'For 7½ hours, enter 450 minutes. Log the date you woke up.'
                  : undefined
              }
            />
          )}
          {kind === 'water' && (
            <FitnessChoices
              label="Quick add"
              options={['150', '250', '500', '750']}
              selected={value}
              onChange={setValue}
            />
          )}
          {kind === 'weight' && (
            <FitnessField
              label="Waist (cm, optional)"
              value={waist}
              onChangeText={setWaist}
              keyboardType="decimal-pad"
            />
          )}
          {kind === 'sleep' && (
            <FitnessChoices
              label="Sleep quality (optional)"
              options={['poor', 'fair', 'good']}
              selected={quality}
              onChange={setQuality}
            />
          )}
          <FitnessField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <FitnessNotice error message={error} />
          <FitnessNotice message={notice} />
          <FitnessAction
            label={id ? 'Save changes' : 'Save entry'}
            busy={mutation.isPending}
            onPress={() => {
              void save();
            }}
          />
          <FitnessSection title="Saved on this date" />
          {query.isPending ? (
            <FitnessLoading />
          ) : query.isError ? (
            <>
              <FitnessNotice error message={query.error.message} />
              <FitnessAction
                label="Retry history"
                secondary
                onPress={() => {
                  void query.refetch();
                }}
              />
            </>
          ) : query.data?.logs.length ? (
            query.data.logs.map(log => (
              <FitnessCard key={log.id}>
                <FitnessText>{logTitle(log)}</FitnessText>
                {(log.data as any).notes && (
                  <FitnessText muted>{(log.data as any).notes}</FitnessText>
                )}
              </FitnessCard>
            ))
          ) : (
            <FitnessText muted>No entries saved for this day.</FitnessText>
          )}
          <FitnessAction
            label="Open all history"
            secondary
            onPress={() => nav.navigate('FitnessHistory')}
          />
        </>
      )}
    </FitnessScreen>
  );
}
