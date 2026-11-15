import React, { useEffect, useRef, useState } from 'react';
import { useFitnessDraftGuard } from '../logging/useFitnessDraftGuard';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  FitnessLog,
  FitnessLogKind,
  FitnessSummary,
} from '@anticlock/contracts';
import {
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import {
  fitnessDateValid,
  fitnessTimezone,
  localFitnessDate,
  logTitle,
} from '../fitnessModel';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessStepper,
  FitnessToggle,
} from '../components/FitnessControls';
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
  water: 'Add water',
  weight: 'Log your weight',
  sleep: 'Log your sleep',
  steps: 'Add your steps',
  habit: 'A small daily habit',
};
const limits = {
  water: { min: 1, max: 15000, step: 50, unit: 'ml' },
  weight: { min: 15, max: 500, step: 0.1, unit: 'kg' },
  sleep: { min: 0, max: 1440, step: 15, unit: 'min' },
  steps: { min: 0, max: 200000, step: 500, unit: 'steps' },
};
export function FitnessLogScreen() {
  const route = useRoute<any>(),
    nav = useNavigation<any>(),
    kind = (route.params?.kind ?? 'water') as Exclude<
      FitnessLogKind,
      'workout' | 'meal'
    >,
    id = route.params?.logId;
  const [date, setDate] = useState(route.params?.date ?? localFitnessDate()),
    [value, setValue] = useState(kind === 'water' ? '250' : ''),
    [waist, setWaist] = useState(''),
    [quality, setQuality] = useState('good'),
    [habitKey, setHabitKey] = useState(''),
    [done, setDone] = useState(true),
    [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const snapshot = JSON.stringify({
    date,
    value,
    waist,
    quality,
    habitKey,
    done,
    notes,
  });
  const savedSnapshot = useRef(snapshot);
  const query = useFitnessQuery<{ logs: FitnessLog[] }>(
    `/logs/${kind}?from=${date}&to=${date}`,
    fitnessDateValid(date),
  );
  const existing = useFitnessQuery<{ log: FitnessLog }>(
    `/logs/${kind}/${id ?? ''}`,
    Boolean(id),
  );
  const current = useFitnessQuery<FitnessSummary>(
    `/summary?date=${localFitnessDate()}&timezone=${encodeURIComponent(
      fitnessTimezone(),
    )}`,
    kind === 'weight' && !id,
  );
  const mutation = useFitnessMutation<any>(),
    requestId = useRef(newFitnessRequestId()),
    signature = useRef(''),
    hydrated = useRef(false),
    touched = useRef(false);
  useEffect(() => {
    if (existing.data && !hydrated.current) {
      const log = existing.data.log,
        data = log.data as any;
      savedSnapshot.current = JSON.stringify({
        date: log.date,
        value: String(
          data.amountMl ??
            data.weightKg ??
            data.durationMinutes ??
            data.count ??
            '',
        ),
        waist: data.waistCm === undefined ? '' : String(data.waistCm),
        quality: data.quality ?? 'good',
        habitKey: data.key ?? '',
        done: data.completed ?? true,
        notes: data.notes ?? '',
      });
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
      setWaist(data.waistCm === undefined ? '' : String(data.waistCm));
      setQuality(data.quality ?? 'good');
      setHabitKey(data.key ?? '');
      setDone(data.completed ?? true);
      setNotes(data.notes ?? '');
      hydrated.current = true;
    }
  }, [existing.data]);
  useEffect(() => {
    if (!id && !touched.current && current.data?.latestWeight) {
      savedSnapshot.current = JSON.stringify({
        ...JSON.parse(savedSnapshot.current),
        value: String(current.data.latestWeight.weightKg),
      });
      setValue(String(current.data.latestWeight.weightKg));
      touched.current = true;
    }
  }, [current.data, id]);
  async function save() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    setNotice('');
    try {
      assertActive();
      if (!fitnessDateValid(date) || date > localFitnessDate())
        throw new Error('Choose today or an earlier date.');
      const n = Number(value),
        limit = kind === 'habit' ? null : limits[kind];
      if (
        limit &&
        (value.trim() === '' ||
          !Number.isFinite(n) ||
          n < limit.min ||
          n > limit.max)
      )
        throw new Error(
          `Choose a value between ${limit.min} and ${limit.max} ${limit.unit}.`,
        );
      if (kind === 'habit' && !habitKey.trim())
        throw new Error('Name the habit you want to record.');
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
      const next = JSON.stringify({ date, data });
      if (signature.current && signature.current !== next)
        requestId.current = newFitnessRequestId();
      signature.current = next;
      await mutation.mutateAsync({
        path: id ? `/logs/${kind}/${id}` : `/logs/${kind}`,
        method: id ? 'PATCH' : 'POST',
        body: id
          ? { data }
          : { date, clientRequestId: requestId.current, data },
      });
      assertActive();
      savedSnapshot.current = id
        ? snapshot
        : JSON.stringify({
            date,
            value: kind === 'water' ? '250' : '',
            waist: '',
            quality,
            habitKey,
            done,
            notes: '',
          });
      setNotice(
        id
          ? 'Changes saved.'
          : kind === 'water'
          ? `${n} ml added.`
          : 'Entry saved.',
      );
      if (!id) {
        setValue(kind === 'water' ? '250' : '');
        setNotes('');
        setWaist('');
        touched.current = true;
        requestId.current = newFitnessRequestId();
        signature.current = '';
      }
      signature.current = '';
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    }
  }
  const guard = useFitnessDraftGuard({
    dirty: snapshot !== savedSnapshot.current || Boolean(signature.current),
    busy: mutation.isPending,
    save,
    onError: setError,
  });
  const unavailable = Boolean(id && (existing.isPending || existing.isError));
  return (
    <FitnessScreen
      title={titles[kind] ?? 'Daily check-in'}
      busy={mutation.isPending || guard.saving}
      footer={
        !unavailable ? (
          <FitnessAction
            label={
              id
                ? 'Save changes'
                : kind === 'water'
                ? `Add ${value || 'a glass of'} ml`
                : 'Save entry'
            }
            busy={mutation.isPending}
            onPress={() => {
              void save();
            }}
          />
        ) : undefined
      }
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
          <FitnessCard tone="soft">
            <FitnessSection
              title={
                kind === 'water'
                  ? 'A glass at a time'
                  : kind === 'weight'
                  ? 'Your own pace'
                  : kind === 'sleep'
                  ? 'Time to recharge'
                  : kind === 'steps'
                  ? 'Every step counts'
                  : 'Make a little space'
              }
            />
            {kind === 'habit' ? (
              <>
                <FitnessField
                  label="Habit name"
                  value={habitKey}
                  onChangeText={setHabitKey}
                  placeholder="e.g. Evening walk"
                />
                <FitnessToggle
                  label="Completed"
                  value={done}
                  onChange={setDone}
                />
              </>
            ) : (
              <FitnessStepper
                label={
                  kind === 'water'
                    ? 'Glass size'
                    : kind === 'weight'
                    ? 'Weight'
                    : kind === 'sleep'
                    ? 'Sleep duration'
                    : 'Steps since your last entry'
                }
                value={value === '' ? undefined : Number(value)}
                onChange={n => {
                  touched.current = true;
                  setValue(String(n));
                }}
                {...limits[kind]}
                initialValue={
                  kind === 'weight'
                    ? 70
                    : kind === 'sleep'
                    ? 480
                    : kind === 'steps'
                    ? 1000
                    : 250
                }
              />
            )}
            {kind === 'water' && (
              <FitnessChoices
                label="Quick amount"
                options={['150 ml', '250 ml', '500 ml', '750 ml']}
                selected={`${value} ml`}
                onChange={v => setValue(v.split(' ')[0])}
              />
            )}
            {kind === 'sleep' && (
              <FitnessChoices
                label="Quick duration"
                options={['6 hours', '7 hours', '8 hours', '9 hours']}
                selected={value ? `${Number(value) / 60} hours` : ''}
                onChange={v => setValue(String(Number(v.split(' ')[0]) * 60))}
              />
            )}
            {kind === 'steps' && (
              <FitnessText muted>
                Add only steps you have not already logged.
              </FitnessText>
            )}
          </FitnessCard>
          <FitnessDisclosure
            title="More details"
            subtitle={new Date(`${date}T12:00:00`).toLocaleDateString()}
          >
            {id ? (
              <FitnessText muted>Recorded {date}</FitnessText>
            ) : (
              <FitnessDatePicker
                label="Entry date"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
              />
            )}
            {kind === 'weight' && (
              <FitnessStepper
                label="Waist · optional"
                value={waist === '' ? undefined : Number(waist)}
                onChange={n => setWaist(String(n))}
                initialValue={80}
                min={20}
                max={350}
                step={0.5}
                unit="cm"
              />
            )}
            {kind === 'weight' && waist !== '' && (
              <FitnessAction
                label="Clear waist measurement"
                secondary
                onPress={() => setWaist('')}
              />
            )}
            {kind === 'sleep' && (
              <FitnessChoices
                label="How did you sleep?"
                options={['poor', 'fair', 'good']}
                selected={quality}
                onChange={setQuality}
              />
            )}
            <FitnessField
              label="Notes · optional"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </FitnessDisclosure>
          <FitnessNotice error message={error} />
          <FitnessNotice message={notice} />
          <FitnessDisclosure
            title="Saved on this date"
            subtitle={
              query.data ? `${query.data.logs.length} entries` : undefined
            }
          >
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
                  <FitnessAction
                    label="Edit entry"
                    secondary
                    onPress={() =>
                      nav.push('FitnessLog', {
                        kind,
                        date: log.date,
                        logId: log.id,
                      })
                    }
                  />
                </FitnessCard>
              ))
            ) : (
              <FitnessText muted>No entries yet.</FitnessText>
            )}
            <FitnessAction
              label="Open all history"
              secondary
              onPress={() => nav.navigate('FitnessHistory')}
            />
          </FitnessDisclosure>
        </>
      )}
    </FitnessScreen>
  );
}
