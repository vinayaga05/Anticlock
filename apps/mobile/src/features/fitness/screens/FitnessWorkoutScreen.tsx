import React, { useEffect, useRef, useState } from 'react';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  FitnessLog,
  FitnessPlan,
  FitnessPlanVersion,
  FitnessProfile,
  FitnessWorkoutDataSchema,
} from '@anticlock/contracts';
import type { z } from 'zod';
import {
  fitnessRequest,
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import {
  FITNESS_REVIEW_GUIDANCE,
  fitnessDateValid,
  localFitnessDate,
} from '../fitnessModel';
import { uploadFitnessMedia } from '../fitnessMedia';
import { FitnessPrivateMedia } from '../components/FitnessPrivateMedia';
import { FitnessExerciseGuide } from '../components/FitnessExerciseGuide';
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

type WorkoutData = z.infer<typeof FitnessWorkoutDataSchema>;
type Exercise = WorkoutData['exercises'][number];
const optionalNumber = (value: string) =>
  value.trim() === '' ? undefined : Number(value);
export function FitnessWorkoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params ?? {};
  const [date, setDate] = useState(params.date ?? localFitnessDate());
  const query = useFitnessQuery<{ logs: FitnessLog[] }>('/logs/workout');
  const plans = useFitnessQuery<{ plans: FitnessPlan[] }>('/plans');
  const mutation = useFitnessMutation<any>();
  const requestId = useRef(newFitnessRequestId());
  const startedAt = useRef(new Date().toISOString());
  const pendingCreate = useRef<any>(null);
  const [currentId, setCurrentId] = useState<string | undefined>(
    params.workoutId,
  );
  const hydrated = useRef('');
  const [draft, setDraft] = useState<WorkoutData>({
    name: '',
    status: 'in_progress',
    exercises: [],
  });
  const [sessionMode, setSessionMode] = useState<'planned' | 'manual'>(
    params.planId ? 'planned' : 'manual',
  );
  const previousSuggested = useRef<string | undefined>(undefined);
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState<
    Array<{
      reps: string;
      weightKg: string;
      durationSeconds: string;
      distanceMetres: string;
    }>
  >([{ reps: '', weightKg: '', durationSeconds: '', distanceMetres: '' }]);
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const mediaPending = useRef<{ file: any; id?: string } | null>(null);
  const linkedPlanId = currentId ? draft.planId : params.planId;
  const plan = linkedPlanId
    ? plans.data?.plans.find(p => p.id === linkedPlanId)
    : !currentId
    ? plans.data?.plans[0]
    : undefined;
  const profile = useFitnessQuery<{ profile: FitnessProfile | null }>(
    '/profile',
  );
  const savedVersions = useFitnessQuery<{ versions: FitnessPlanVersion[] }>(
    `/plans/${draft.planId ?? ''}/versions`,
    Boolean(currentId && draft.planId && draft.planVersion !== undefined),
  );
  const savedContent = currentId
    ? savedVersions.data?.versions?.find(v => v.version === draft.planVersion)
        ?.content
    : undefined;
  const instructionContent = currentId
    ? savedContent
    : sessionMode === 'planned'
    ? plan?.content
    : undefined;
  const reviewRequired =
    profile.data?.profile?.status !== 'complete' ||
    Boolean(
      profile.data?.profile?.baseline?.requiresProfessionalReview ||
        plan?.status === 'needs_review' ||
        plan?.content.requiresProfessionalReview ||
        instructionContent?.requiresProfessionalReview,
    );
  const candidate = reviewRequired
    ? undefined
    : plan?.content.workouts.find(
        w => w.day === (params.day ?? new Date(`${date}T12:00:00`).getDay()),
      );
  const suggested = reviewRequired
    ? undefined
    : instructionContent?.workouts.find(
        w =>
          w.day ===
          ((currentId ? draft.planDay : params.day) ??
            new Date(`${date}T12:00:00`).getDay()),
      );
  const matchesPlannedDate = Boolean(
    suggested && suggested.day === new Date(`${date}T12:00:00`).getDay(),
  );
  const exact = useFitnessQuery<{ log: FitnessLog }>(
    `/logs/workout/${params.workoutId ?? ''}`,
    Boolean(params.workoutId),
  );
  const saved =
    exact.data?.log ??
    query.data?.logs.find(log => log.id === currentId) ??
    (!params.workoutId
      ? query.data?.logs.find(
          log =>
            log.date === date &&
            ['in_progress', 'paused'].includes(
              (log.data as WorkoutData).status,
            ),
        )
      : undefined);
  useEffect(() => {
    if (saved && hydrated.current !== saved.id) {
      const data = saved.data as WorkoutData;
      setCurrentId(saved.id);
      setDate(saved.date);
      setDraft(data);
      setSessionMode(data.planId ? 'planned' : 'manual');
      hydrated.current = saved.id;
    }
  }, [saved]);
  useEffect(() => {
    if (
      !currentId &&
      suggested &&
      (!draft.name || draft.name === previousSuggested.current)
    )
      setDraft(d => ({ ...d, name: suggested.name }));
    previousSuggested.current = suggested?.name;
  }, [suggested, currentId, draft.name]);
  function result(log: FitnessLog) {
    setCurrentId(log.id);
    hydrated.current = log.id;
    setDraft(log.data as WorkoutData);
  }
  async function patchWorkout(
    id: string,
    data: WorkoutData,
  ): Promise<{ log: FitnessLog }> {
    try {
      return await mutation.mutateAsync({
        path: `/logs/workout/${id}`,
        method: 'PATCH',
        body: { data },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== 'use_workout_action') throw e;
      const current = await fitnessRequest<{ log: FitnessLog }>(
        `/logs/workout/${id}`,
      );
      const live = current.log.data as WorkoutData;
      return mutation.mutateAsync({
        path: `/logs/workout/${id}`,
        method: 'PATCH',
        body: {
          data: {
            ...live,
            ...data,
            status: live.status,
            startedAt: live.startedAt,
            completedAt: live.completedAt,
          },
        },
      });
    }
  }
  async function persist(data = draft) {
    if (!fitnessDateValid(date))
      throw new Error('Enter a valid date in YYYY-MM-DD format.');
    if (!data.name.trim()) throw new Error('Give your workout a name.');
    let response;
    if (currentId) response = await patchWorkout(currentId, data);
    else {
      // Retry the original create after a lost acknowledgement, then apply edits.
      // Changing the UUID here could create a second workout on the server.
      pendingCreate.current ??= {
        date,
        clientRequestId: requestId.current,
        data: {
          ...data,
          startedAt: startedAt.current,
          ...(plan &&
          suggested &&
          sessionMode === 'planned' &&
          matchesPlannedDate
            ? {
                planId: plan.id,
                planDay: suggested.day,
                planVersion: plan.currentVersion,
              }
            : {}),
        },
      };
      response = await mutation.mutateAsync({
        path: '/logs/workout',
        body: pendingCreate.current,
      });
      setCurrentId(response.log.id);
      hydrated.current = response.log.id;
      const updated = { ...pendingCreate.current.data, ...data };
      if (
        JSON.stringify(updated) !== JSON.stringify(pendingCreate.current.data)
      )
        response = await patchWorkout(response.log.id, updated);
    }
    result(response.log);
    return response.log as FitnessLog;
  }
  async function saveWorkout() {
    setError('');
    try {
      await persist();
      setNotice('Workout saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function action(
    value: 'pause' | 'resume' | 'complete' | 'skip' | 'request_help',
  ) {
    setError('');
    setNotice('');
    try {
      const log = await persist();
      const response = await mutation.mutateAsync({
        path: `/workouts/${log.id}/actions`,
        body: {
          action: value,
          ...(draft.painNote ? { painNote: draft.painNote } : {}),
        },
      });
      result(response.log);
      setNotice(
        value === 'request_help'
          ? 'Help request saved. Contact your expert for a response; for urgent symptoms seek emergency care.'
          : `Workout ${
              value === 'complete'
                ? 'completed'
                : value === 'skip'
                ? 'skipped'
                : value === 'pause'
                ? 'paused'
                : 'resumed'
            }.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addExercise() {
    setError('');
    const entered = sets.filter(s =>
      Object.values(s).some(v => v.trim() !== ''),
    );
    if (!exerciseName.trim() || !entered.length) {
      setError('Enter an exercise name and at least one set measurement.');
      return;
    }
    const parsed = entered.map(set =>
      Object.fromEntries(
        Object.entries(set)
          .filter(([, value]) => value.trim() !== '')
          .map(([key, value]) => [key, Number(value)]),
      ),
    );
    if (
      parsed.some(set =>
        Object.values(set).some(value => !Number.isFinite(value) || value < 0),
      )
    ) {
      setError('Set values must be positive numbers or zero.');
      return;
    }
    const exercise: Exercise = {
      name: exerciseName.trim(),
      sets: parsed,
      ...(exerciseNotes ? { notes: exerciseNotes } : {}),
    };
    setDraft(d => ({ ...d, exercises: [...d.exercises, exercise] }));
    setExerciseName('');
    setSets([
      { reps: '', weightKg: '', durationSeconds: '', distanceMetres: '' },
    ]);
    setExerciseNotes('');
    setNotice('Exercise added to your draft. Save the workout to keep it.');
  }
  async function attach() {
    setError('');
    setUploading(true);
    try {
      if (!mediaPending.current) {
        const picked = await launchImageLibrary({
          mediaType: 'mixed',
          selectionLimit: 1,
        });
        if (picked.didCancel) return;
        const asset = picked.assets?.[0];
        if (picked.errorCode || !asset?.uri || !asset.type)
          throw new Error(
            picked.errorMessage || 'Choose a readable photo or video.',
          );
        mediaPending.current = {
          file: {
            uri: asset.uri,
            name: asset.fileName || `workout-${Date.now()}`,
            type: asset.type,
            purpose: 'workout',
            clientRequestId: newFitnessRequestId(),
          },
        };
      }
      const media = mediaPending.current.id
        ? { id: mediaPending.current.id }
        : await uploadFitnessMedia(mediaPending.current.file);
      mediaPending.current.id = media.id;
      const next = {
        ...draft,
        mediaIds: [...new Set([...(draft.mediaIds ?? []), media.id])],
      };
      setDraft(next);
      await persist(next);
      mediaPending.current = null;
      setNotice('Private workout media attached. Sharing remains off.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const locked = draft.status === 'completed' || draft.status === 'skipped';
  return (
    <FitnessScreen
      busy={mutation.isPending || uploading}
      title="Move at your pace"
      subtitle="Record what you actually do. Stop if you feel pain, dizziness or unusual symptoms."
    >
      {plan?.status === 'needs_review' && (
        <FitnessNotice message="Your assessment changed. Saved exercise guidance is paused until your assessment and plan are reviewed. You can still record your own activity." />
      )}
      {query.isPending || (params.workoutId && exact.isPending) ? (
        <FitnessLoading />
      ) : query.isError || exact.isError ? (
        <>
          <FitnessNotice
            error
            message={(query.error ?? exact.error)?.message}
          />
          <FitnessAction
            label="Retry workout history"
            onPress={() => {
              void query.refetch();
              if (params.workoutId) void exact.refetch();
            }}
          />
        </>
      ) : (
        <>
          <FitnessCard tone="soft">
            <FitnessSection
              title={suggested?.name ?? 'Your workout journal'}
              caption={
                currentId
                  ? `Saved · ${draft.status.replace(/_/g, ' ')}`
                  : 'Not started yet'
              }
            />
            {suggested?.exercises.map((exercise, i) => (
              <FitnessCard key={i}>
                <FitnessText muted>
                  {exercise.name} · {exercise.sets} sets
                  {exercise.reps ? ` × ${exercise.reps}` : ''}
                  {exercise.durationSeconds
                    ? ` · ${exercise.durationSeconds}s`
                    : ''}
                  {exercise.restSeconds
                    ? ` · rest ${exercise.restSeconds}s`
                    : ''}
                  {exercise.instructions ? `\n${exercise.instructions}` : ''}
                  {exercise.notes ? `\n${exercise.notes}` : ''}
                  {exercise.substitutions?.length
                    ? `\nAlternatives: ${exercise.substitutions.join(', ')}`
                    : ''}
                </FitnessText>
                {exercise.mediaId && (
                  <FitnessPrivateMedia mediaId={exercise.mediaId} />
                )}
                {!exercise.mediaId && (
                  <FitnessExerciseGuide name={exercise.name} />
                )}
              </FitnessCard>
            ))}
            {plan?.content.requiresProfessionalReview && (
              <FitnessNotice message={FITNESS_REVIEW_GUIDANCE} />
            )}
          </FitnessCard>
          <FitnessField
            label="Workout date"
            value={date}
            onChangeText={setDate}
            editable={!currentId}
            placeholder="YYYY-MM-DD"
          />
          {!currentId && candidate && !pendingCreate.current && (
            <FitnessChoices
              label="Session type"
              options={['Saved plan workout', 'My own activity']}
              selected={
                sessionMode === 'planned'
                  ? 'Saved plan workout'
                  : 'My own activity'
              }
              onChange={value => {
                setSessionMode(
                  value === 'Saved plan workout' ? 'planned' : 'manual',
                );
                if (draft.name === suggested?.name)
                  setDraft(d => ({ ...d, name: '' }));
              }}
            />
          )}
          {!currentId && suggested && !matchesPlannedDate && (
            <FitnessNotice
              message={`This saved session is scheduled on ${
                [
                  'Sunday',
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                ][suggested.day]
              }. On ${date}, it is recorded as your own activity rather than scheduled completion.`}
            />
          )}
          {currentId && draft.planId && (
            <FitnessNotice
              message={
                draft.planVersion === undefined
                  ? 'The plan version was not recorded for this older session. Showing your saved journal only.'
                  : `Linked to saved plan version ${draft.planVersion}. Only that version’s available instructions are shown.`
              }
            />
          )}
          {currentId &&
            draft.planVersion !== undefined &&
            (savedVersions.isPending ? (
              <FitnessLoading />
            ) : savedVersions.isError ? (
              <>
                <FitnessNotice message="The recorded plan version could not be loaded. Your journal remains available." />
                <FitnessAction
                  label="Retry recorded plan instructions"
                  secondary
                  onPress={() => {
                    void savedVersions.refetch();
                  }}
                />
              </>
            ) : !savedContent ? (
              <FitnessNotice message="The recorded plan version is unavailable. Showing your journal only." />
            ) : null)}
          <FitnessField
            label="Workout name"
            value={draft.name}
            editable={!locked}
            onChangeText={name => setDraft(d => ({ ...d, name }))}
          />
          {!currentId && (
            <FitnessAction
              label="Start workout"
              icon="play"
              busy={mutation.isPending}
              onPress={() => {
                void saveWorkout();
              }}
            />
          )}
          {draft.exercises.map((exercise, index) => (
            <FitnessCard key={index}>
              <FitnessSection title={exercise.name} />
              {exercise.sets.map((set, i) => (
                <FitnessText key={i}>
                  Set {i + 1}:{' '}
                  {Object.entries(set)
                    .map(
                      ([key, value]) =>
                        `${value} ${
                          {
                            reps: 'reps',
                            weightKg: 'kg',
                            durationSeconds: 'sec',
                            distanceMetres: 'm',
                          }[key] ?? key
                        }`,
                    )
                    .join(' · ')}
                </FitnessText>
              ))}
              {exercise.notes && (
                <FitnessText muted>{exercise.notes}</FitnessText>
              )}
              {!locked && (
                <FitnessAction
                  label={`Remove ${exercise.name}`}
                  secondary
                  onPress={() =>
                    setDraft(d => ({
                      ...d,
                      exercises: d.exercises.filter((_, i) => i !== index),
                    }))
                  }
                />
              )}
            </FitnessCard>
          ))}
          {!locked && (
            <FitnessCard>
              <FitnessSection title="Log an exercise" />
              <FitnessField
                label="Exercise name"
                value={exerciseName}
                onChangeText={setExerciseName}
              />
              {sets.map((set, index) => (
                <FitnessCard key={index}>
                  <FitnessText>Set {index + 1}</FitnessText>
                  {(
                    [
                      'reps',
                      'weightKg',
                      'durationSeconds',
                      'distanceMetres',
                    ] as const
                  ).map(key => (
                    <FitnessField
                      key={key}
                      label={`${
                        {
                          reps: 'Reps',
                          weightKg: 'Weight (kg)',
                          durationSeconds: 'Duration (seconds)',
                          distanceMetres: 'Distance (metres)',
                        }[key]
                      } · set ${index + 1}`}
                      value={set[key]}
                      keyboardType="decimal-pad"
                      onChangeText={value =>
                        setSets(rows =>
                          rows.map((row, i) =>
                            i === index ? { ...row, [key]: value } : row,
                          ),
                        )
                      }
                    />
                  ))}
                  {sets.length > 1 && (
                    <FitnessAction
                      label={`Remove set ${index + 1}`}
                      secondary
                      onPress={() =>
                        setSets(rows => rows.filter((_, i) => i !== index))
                      }
                    />
                  )}
                </FitnessCard>
              ))}
              <FitnessAction
                label="Add another set"
                secondary
                onPress={() =>
                  setSets(rows => [
                    ...rows,
                    {
                      reps: '',
                      weightKg: '',
                      durationSeconds: '',
                      distanceMetres: '',
                    },
                  ])
                }
              />
              <FitnessField
                label="Exercise notes (optional)"
                value={exerciseNotes}
                onChangeText={setExerciseNotes}
                multiline
              />
              <FitnessAction
                label="Add exercise to workout"
                onPress={addExercise}
              />
            </FitnessCard>
          )}
          <FitnessField
            label="Workout duration (minutes, optional)"
            keyboardType="decimal-pad"
            value={
              draft.durationMinutes === undefined
                ? ''
                : String(draft.durationMinutes)
            }
            onChangeText={value =>
              setDraft(d => ({ ...d, durationMinutes: optionalNumber(value) }))
            }
            editable={!locked}
          />
          <FitnessField
            label="Calories from your device (optional)"
            keyboardType="decimal-pad"
            value={draft.calories === undefined ? '' : String(draft.calories)}
            onChangeText={value =>
              setDraft(d => ({ ...d, calories: optionalNumber(value) }))
            }
            editable={!locked}
          />
          <FitnessField
            label="Workout notes"
            value={draft.notes ?? ''}
            multiline
            editable={!locked}
            onChangeText={notes => setDraft(d => ({ ...d, notes }))}
          />
          {!locked && (
            <>
              <FitnessAction
                label="Save workout"
                busy={mutation.isPending}
                onPress={() => {
                  void saveWorkout();
                }}
              />
              <FitnessAction
                label={
                  draft.status === 'paused' ? 'Resume workout' : 'Pause workout'
                }
                secondary
                disabled={!currentId}
                busy={mutation.isPending}
                onPress={() => {
                  void action(draft.status === 'paused' ? 'resume' : 'pause');
                }}
              />
              <FitnessAction
                label="Complete workout"
                busy={mutation.isPending}
                onPress={() => {
                  void action('complete');
                }}
              />
              <FitnessAction
                label="Skip workout"
                secondary
                busy={mutation.isPending}
                onPress={() => {
                  void action('skip');
                }}
              />
              <FitnessAction
                label={
                  mediaPending.current
                    ? 'Retry private media attachment'
                    : 'Attach a private photo or video'
                }
                icon="camera"
                secondary
                busy={uploading}
                onPress={() => {
                  void attach();
                }}
              />
            </>
          )}
          {!!draft.mediaIds?.length && (
            <FitnessText muted>
              {draft.mediaIds.length} private attachment(s). You choose any
              expert sharing separately.
            </FitnessText>
          )}
          {draft.mediaIds?.map(mediaId => (
            <FitnessPrivateMedia
              key={mediaId}
              mediaId={mediaId}
              onDelete={() => {
                const next = {
                  ...draft,
                  mediaIds: draft.mediaIds?.filter(id => id !== mediaId),
                };
                setDraft(next);
                void persist(next).catch(e => setError((e as Error).message));
              }}
            />
          ))}
          <FitnessCard>
            <FitnessSection title="Something doesn't feel right?" />
            <FitnessField
              label="Pain or help note (optional)"
              multiline
              value={draft.painNote ?? ''}
              onChangeText={painNote => setDraft(d => ({ ...d, painNote }))}
            />
            <FitnessAction
              label="Save a help request"
              secondary
              busy={mutation.isPending}
              onPress={() => {
                void action('request_help');
              }}
            />
            <FitnessAction
              label="Contact a qualified expert"
              secondary
              onPress={() => nav.navigate('FitnessExperts')}
            />
            <FitnessText muted>
              A saved request does not provide emergency monitoring. For severe
              or urgent symptoms, seek emergency care.
            </FitnessText>
          </FitnessCard>
          <FitnessNotice message={error} error />
          <FitnessNotice message={notice} />
          {currentId && (
            <FitnessAction
              label="Choose what to share with an expert"
              secondary
              onPress={() => nav.navigate('FitnessExperts')}
            />
          )}
        </>
      )}
    </FitnessScreen>
  );
}
