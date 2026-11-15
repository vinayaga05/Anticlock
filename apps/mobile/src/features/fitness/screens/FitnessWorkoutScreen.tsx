import React, { useEffect, useRef, useState } from 'react';
import { useFitnessDraftGuard } from '../logging/useFitnessDraftGuard';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessSheet,
  FitnessStepper,
} from '../components/FitnessControls';
import { FitnessPhoto } from '../components/FitnessVisuals';
import { FitnessMediaSourceSheet } from '../components/FitnessMediaSourceSheet';
import type { PickedFitnessMedia } from '../logging/fitnessMediaPicker';
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
  const [mediaChooser, setMediaChooser] = useState(false);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const mediaPending = useRef<{ file: any; id?: string } | null>(null);
  const snapshot = JSON.stringify({
    date,
    draft,
    exerciseName,
    sets,
    exerciseNotes,
  });
  const savedSnapshot = useRef(snapshot);
  const blankEditor = {
    exerciseName: '',
    sets: [{ reps: '', weightKg: '', durationSeconds: '', distanceMetres: '' }],
    exerciseNotes: '',
  };
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
      if (!currentId && !params.workoutId && snapshot !== savedSnapshot.current)
        return;
      const data = saved.data as WorkoutData;
      savedSnapshot.current = JSON.stringify({
        date: saved.date,
        draft: data,
        ...blankEditor,
      });
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
    ) {
      const previous = JSON.parse(savedSnapshot.current);
      savedSnapshot.current = JSON.stringify({
        ...previous,
        draft: { ...previous.draft, name: suggested.name },
      });
      setDraft(d => ({ ...d, name: suggested.name }));
    }
    previousSuggested.current = suggested?.name;
  }, [suggested, currentId, draft.name]);
  function result(log: FitnessLog) {
    savedSnapshot.current = JSON.stringify({
      date: log.date,
      draft: log.data,
      ...blankEditor,
    });
    setCurrentId(log.id);
    hydrated.current = log.id;
    setDraft(log.data as WorkoutData);
  }
  async function patchWorkout(
    id: string,
    data: WorkoutData,
    assertActive = guard.captureOperation(),
  ): Promise<{ log: FitnessLog }> {
    try {
      assertActive();
      const response = await mutation.mutateAsync({
        path: `/logs/workout/${id}`,
        method: 'PATCH',
        body: { data },
      });
      assertActive();
      return response;
    } catch (e) {
      assertActive();
      if ((e as { code?: string }).code !== 'use_workout_action') throw e;
      const current = await fitnessRequest<{ log: FitnessLog }>(
        `/logs/workout/${id}`,
      );
      assertActive();
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
  async function persist(
    data = draft,
    assertActive = guard.captureOperation(),
  ) {
    assertActive();
    if (!fitnessDateValid(date))
      throw new Error('Enter a valid date in YYYY-MM-DD format.');
    if (!data.name.trim()) throw new Error('Give your workout a name.');
    let response;
    if (currentId) response = await patchWorkout(currentId, data, assertActive);
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
      const create = pendingCreate.current;
      assertActive();
      response = await mutation.mutateAsync({
        path: '/logs/workout',
        body: create,
      });
      assertActive();
      setCurrentId(response.log.id);
      hydrated.current = response.log.id;
      const updated = { ...create.data, ...data };
      if (JSON.stringify(updated) !== JSON.stringify(create.data))
        response = await patchWorkout(response.log.id, updated, assertActive);
    }
    assertActive();
    result(response.log);
    return response.log as FitnessLog;
  }
  async function saveWorkout() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      await persist(draft, assertActive);
      assertActive();
      setNotice('Workout saved.');
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    }
  }
  async function action(
    value: 'pause' | 'resume' | 'complete' | 'skip' | 'request_help',
  ) {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return;
    setError('');
    setNotice('');
    try {
      assertActive();
      const log = await persist(draft, assertActive);
      assertActive();
      const response = await mutation.mutateAsync({
        path: `/workouts/${log.id}/actions`,
        body: {
          action: value,
          ...(draft.painNote ? { painNote: draft.painNote } : {}),
        },
      });
      assertActive();
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
      if (guard.isActive()) setError((e as Error).message);
    }
  }
  function readExercise(): Exercise {
    const entered = sets.filter(set =>
      Object.values(set).some(value => value.trim() !== ''),
    );
    if (!exerciseName.trim() || !entered.length)
      throw new Error(
        'Enter an exercise name and at least one set measurement.',
      );
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
    )
      throw new Error('Set values must be positive numbers or zero.');
    return {
      name: exerciseName.trim(),
      sets: parsed,
      ...(exerciseNotes ? { notes: exerciseNotes } : {}),
    };
  }
  function clearEditor() {
    setExerciseName('');
    setSets(blankEditor.sets);
    setExerciseNotes('');
  }
  function addExercise() {
    setError('');
    try {
      const exercise = readExercise();
      setDraft(data => ({ ...data, exercises: [...data.exercises, exercise] }));
      clearEditor();
      setNotice('Exercise added. Save your workout to keep it.');
      return true;
    } catch (problem) {
      if (guard.isActive()) setError((problem as Error).message);
      return false;
    }
  }
  async function attach(
    asset?: PickedFitnessMedia,
    data = draft,
    assertActive = guard.captureOperation(),
  ) {
    if (!guard.isActive()) return false;
    setError('');
    setUploading(true);
    try {
      assertActive();
      if (!mediaPending.current) {
        if (!asset) return false;
        mediaPending.current = {
          file: {
            uri: asset.uri,
            name: asset.name,
            byteSize: asset.byteSize,
            type: asset.type,
            purpose: 'workout',
            clientRequestId: newFitnessRequestId(),
          },
        };
      }
      const pending = mediaPending.current;
      const media = pending.id
        ? { id: pending.id }
        : await uploadFitnessMedia(pending.file);
      assertActive();
      pending.id = media.id;
      const next = {
        ...data,
        mediaIds: [...new Set([...(data.mediaIds ?? []), media.id])],
      };
      assertActive();
      await persist(next, assertActive);
      assertActive();
      mediaPending.current = null;
      setNotice('Private workout media attached. Sharing remains off.');
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    } finally {
      if (guard.isActive()) setUploading(false);
    }
  }
  async function saveForExit() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
      const hasEditor = Boolean(
        exerciseName.trim() ||
          exerciseNotes.trim() ||
          sets.some(set =>
            Object.values(set).some(value => value.trim() !== ''),
          ),
      );
      const next = hasEditor
        ? { ...draft, exercises: [...draft.exercises, readExercise()] }
        : draft;
      if (mediaPending.current) {
        if (!(await attach(undefined, next, assertActive))) return false;
      } else await persist(next, assertActive);
      assertActive();
      if (hasEditor) clearEditor();
      return true;
    } catch (problem) {
      if (guard.isActive()) setError((problem as Error).message);
      return false;
    }
  }
  const guard = useFitnessDraftGuard({
    dirty:
      snapshot !== savedSnapshot.current ||
      Boolean(mediaPending.current) ||
      (!currentId && Boolean(pendingCreate.current)),
    busy: mutation.isPending || uploading,
    save: saveForExit,
    onError: setError,
  });
  const locked = draft.status === 'completed' || draft.status === 'skipped';
  const loading =
    query.isPending ||
    (params.workoutId && exact.isPending) ||
    (params.planId && (plans.isPending || profile.isPending));
  const failed = query.isError || exact.isError;
  const primaryLabel = locked
    ? 'Open workout history'
    : !currentId
    ? 'Start workout'
    : draft.status === 'paused'
    ? 'Resume workout'
    : 'Complete workout';
  return (
    <FitnessScreen
      title="Your workout"
      busy={mutation.isPending || uploading || guard.saving}
      footer={
        !loading && !failed ? (
          <FitnessAction
            label={primaryLabel}
            icon={locked ? 'activity' : !currentId ? 'play' : undefined}
            busy={mutation.isPending}
            onPress={() => {
              if (locked) nav.navigate('FitnessHistory');
              else if (!currentId) void saveWorkout();
              else
                void action(draft.status === 'paused' ? 'resume' : 'complete');
            }}
          />
        ) : undefined
      }
    >
      {loading ? (
        <FitnessLoading />
      ) : failed ? (
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
          <FitnessPhoto
            kind={
              /strength|resistance/i.test(suggested?.name ?? draft.name)
                ? 'strength'
                : /yoga|mobility/i.test(suggested?.name ?? draft.name)
                ? 'yoga'
                : 'workout'
            }
            label="Movement and fitness"
          >
            <FitnessSection
              title={suggested?.name || draft.name || 'Move at your pace'}
              caption={
                currentId
                  ? draft.status.replace(/_/g, ' ')
                  : suggested
                  ? `${suggested.durationMinutes} min · saved plan`
                  : 'Log your own activity'
              }
            />
          </FitnessPhoto>
          {locked &&
            (draft.durationMinutes !== undefined ||
              draft.calories !== undefined) && (
              <FitnessText muted>
                {[
                  draft.durationMinutes !== undefined
                    ? `${draft.durationMinutes} min recorded`
                    : '',
                  draft.calories !== undefined
                    ? `${draft.calories} kcal from your device`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </FitnessText>
            )}
          {reviewRequired && plan?.content.requiresProfessionalReview && (
            <FitnessNotice message={FITNESS_REVIEW_GUIDANCE} />
          )}
          {!currentId && candidate && !pendingCreate.current && (
            <FitnessChoices
              label="Workout"
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
          {(!suggested || sessionMode === 'manual') && !currentId && (
            <FitnessCard>
              <FitnessChoices
                label="Activity"
                options={['Walk', 'Strength', 'Yoga', 'Cycling', 'Other']}
                selected={draft.name}
                onChange={name =>
                  setDraft(d => ({ ...d, name: name === 'Other' ? '' : name }))
                }
              />
              <FitnessField
                label="Workout name"
                value={draft.name}
                onChangeText={name => setDraft(d => ({ ...d, name }))}
                placeholder="Name your activity"
              />
            </FitnessCard>
          )}
          {!currentId &&
            !params.workoutId &&
            saved &&
            snapshot !== savedSnapshot.current && (
              <FitnessAction
                label="Open saved workout for this date"
                secondary
                onPress={() =>
                  nav.push('FitnessWorkout', {
                    workoutId: saved.id,
                    date: saved.date,
                  })
                }
              />
            )}
          {currentId && draft.status === 'in_progress' && (
            <FitnessAction
              label="Pause workout"
              secondary
              busy={mutation.isPending}
              onPress={() => {
                void action('pause');
              }}
            />
          )}
          {suggested && (
            <FitnessDisclosure
              title="Your planned exercises"
              subtitle={`${suggested.exercises.length} exercises`}
              defaultOpen={!currentId}
            >
              {suggested.exercises.map((exercise, i) => (
                <FitnessCard key={i}>
                  <FitnessSection
                    title={exercise.name}
                    caption={`${exercise.sets} sets${
                      exercise.reps ? ` × ${exercise.reps} reps` : ''
                    }${
                      exercise.durationSeconds
                        ? ` · ${exercise.durationSeconds}s`
                        : ''
                    }`}
                  />
                  {!locked && (
                    <FitnessAction
                      label={`Log ${exercise.name}`}
                      secondary
                      onPress={() => {
                        setExerciseName(exercise.name);
                        setSets(
                          Array.from({ length: exercise.sets }, () => ({
                            reps: '',
                            weightKg: '',
                            durationSeconds: '',
                            distanceMetres: '',
                          })),
                        );
                        setExerciseOpen(true);
                      }}
                    />
                  )}
                  <FitnessDisclosure title="How to do it">
                    {exercise.instructions && (
                      <FitnessText>{exercise.instructions}</FitnessText>
                    )}
                    {exercise.restSeconds && (
                      <FitnessText muted>
                        {exercise.restSeconds}s rest between sets
                      </FitnessText>
                    )}
                    {exercise.notes && (
                      <FitnessText muted>{exercise.notes}</FitnessText>
                    )}
                    {exercise.substitutions?.length ? (
                      <FitnessText muted>
                        Alternatives: {exercise.substitutions.join(', ')}
                      </FitnessText>
                    ) : null}
                    {exercise.mediaId ? (
                      <FitnessPrivateMedia mediaId={exercise.mediaId} />
                    ) : (
                      <FitnessExerciseGuide name={exercise.name} />
                    )}
                  </FitnessDisclosure>
                </FitnessCard>
              ))}
            </FitnessDisclosure>
          )}
          <FitnessSection
            title="What you did"
            caption={
              draft.exercises.length
                ? `${draft.exercises.length} exercises recorded`
                : 'Add sets as you go. Only your entries are saved.'
            }
          />
          {draft.exercises.map((exercise, index) => (
            <FitnessCard key={index}>
              <FitnessSection title={exercise.name} />
              {exercise.sets.map((set, i) => (
                <FitnessText key={i}>
                  Set {i + 1} ·{' '}
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
                <FitnessDisclosure title="Exercise options">
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
                </FitnessDisclosure>
              )}
            </FitnessCard>
          ))}
          {!locked && (
            <FitnessAction
              label="Add exercise"
              secondary
              icon="plus"
              onPress={() => setExerciseOpen(true)}
            />
          )}
          {!locked && (
            <FitnessStepper
              label="Minutes recorded · optional"
              value={draft.durationMinutes}
              min={0}
              max={1440}
              step={5}
              unit="min"
              onChange={durationMinutes =>
                setDraft(d => ({ ...d, durationMinutes }))
              }
            />
          )}
          <FitnessDisclosure title="More details" subtitle={date}>
            {currentId ? (
              <FitnessText muted>
                Recorded {date}
                {draft.planVersion !== undefined
                  ? ` · plan version ${draft.planVersion}`
                  : ''}
              </FitnessText>
            ) : (
              <FitnessDatePicker
                label="Workout date"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
              />
            )}
            {!locked && (
              <>
                <FitnessField
                  label="Workout name"
                  value={draft.name}
                  onChangeText={name => setDraft(d => ({ ...d, name }))}
                />
                <FitnessStepper
                  label="Calories from your device · optional"
                  value={draft.calories}
                  min={0}
                  max={20000}
                  step={10}
                  unit="kcal"
                  onChange={calories => setDraft(d => ({ ...d, calories }))}
                />
                {(draft.calories !== undefined ||
                  draft.durationMinutes !== undefined) && (
                  <FitnessAction
                    label="Clear optional workout numbers"
                    secondary
                    onPress={() =>
                      setDraft(d => {
                        const { calories, durationMinutes, ...rest } = d;
                        return rest;
                      })
                    }
                  />
                )}
                <FitnessField
                  label="Workout notes"
                  value={draft.notes ?? ''}
                  multiline
                  onChangeText={notes => setDraft(d => ({ ...d, notes }))}
                />
                <FitnessAction
                  label="Save workout"
                  secondary
                  busy={mutation.isPending}
                  onPress={() => {
                    void saveWorkout();
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
              </>
            )}
            {!matchesPlannedDate && suggested && !currentId && (
              <FitnessText muted>
                This session is saved as your own activity on {date}; it does
                not count as a scheduled completion.
              </FitnessText>
            )}
            {currentId &&
              draft.planVersion !== undefined &&
              (savedVersions.isPending ? (
                <FitnessLoading />
              ) : savedVersions.isError ? (
                <>
                  <FitnessNotice message="Saved instructions are temporarily unavailable." />
                  <FitnessAction
                    label="Retry recorded plan instructions"
                    secondary
                    onPress={() => {
                      void savedVersions.refetch();
                    }}
                  />
                </>
              ) : !savedContent ? (
                <FitnessText muted>
                  The original instructions are unavailable. Your journal is
                  still saved.
                </FitnessText>
              ) : null)}
          </FitnessDisclosure>
          <FitnessDisclosure
            title="Private photos & video"
            subtitle={
              draft.mediaIds?.length
                ? `${draft.mediaIds.length} attachments`
                : 'Optional'
            }
          >
            {!locked && (
              <FitnessAction
                label={
                  mediaPending.current
                    ? 'Retry private media attachment'
                    : 'Add private photo or video'
                }
                icon="camera"
                secondary
                busy={uploading}
                onPress={() => {
                  if (mediaPending.current) void attach();
                  else setMediaChooser(true);
                }}
              />
            )}
            {draft.mediaIds?.map(mediaId => (
              <FitnessPrivateMedia
                key={mediaId}
                mediaId={mediaId}
                onDelete={() => {
                  if (!guard.isActive()) return;
                  const next = {
                    ...draft,
                    mediaIds: draft.mediaIds?.filter(id => id !== mediaId),
                  };
                  setDraft(next);
                  void persist(next).catch(e => setError((e as Error).message));
                }}
              />
            ))}
          </FitnessDisclosure>
          <FitnessDisclosure
            title="Need support?"
            subtitle="Stop if you feel pain or unusual symptoms."
          >
            <FitnessField
              label="Pain or help note · optional"
              value={draft.painNote ?? ''}
              multiline
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
              Requests are not monitored for emergencies. Seek emergency care
              for urgent symptoms.
            </FitnessText>
          </FitnessDisclosure>
          <FitnessNotice error message={error} />
          <FitnessNotice message={notice} />
        </>
      )}
      <FitnessSheet
        visible={exerciseOpen}
        title="Log an exercise"
        onClose={() => setExerciseOpen(false)}
      >
        <FitnessField
          label="Exercise name"
          value={exerciseName}
          onChangeText={setExerciseName}
        />
        {sets.map((set, index) => (
          <FitnessCard key={index}>
            <FitnessText>Set {index + 1}</FitnessText>
            <FitnessStepper
              label={`Reps · set ${index + 1}`}
              value={optionalNumber(set.reps)}
              min={0}
              max={1000}
              step={1}
              onChange={value =>
                setSets(rows =>
                  rows.map((row, i) =>
                    i === index ? { ...row, reps: String(value) } : row,
                  ),
                )
              }
            />
            <FitnessStepper
              label={`Weight · set ${index + 1}`}
              value={optionalNumber(set.weightKg)}
              min={0}
              max={1000}
              step={0.5}
              unit="kg"
              onChange={value =>
                setSets(rows =>
                  rows.map((row, i) =>
                    i === index ? { ...row, weightKg: String(value) } : row,
                  ),
                )
              }
            />
            <FitnessDisclosure title="Time or distance">
              <FitnessStepper
                label={`Duration · set ${index + 1}`}
                value={optionalNumber(set.durationSeconds)}
                min={0}
                max={86400}
                step={15}
                unit="sec"
                onChange={value =>
                  setSets(rows =>
                    rows.map((row, i) =>
                      i === index
                        ? { ...row, durationSeconds: String(value) }
                        : row,
                    ),
                  )
                }
              />
              <FitnessStepper
                label={`Distance · set ${index + 1}`}
                value={optionalNumber(set.distanceMetres)}
                min={0}
                max={300000}
                step={50}
                unit="m"
                onChange={value =>
                  setSets(rows =>
                    rows.map((row, i) =>
                      i === index
                        ? { ...row, distanceMetres: String(value) }
                        : row,
                    ),
                  )
                }
              />
            </FitnessDisclosure>
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
        <FitnessDisclosure title="Exercise notes">
          <FitnessField
            label="Notes · optional"
            value={exerciseNotes}
            onChangeText={setExerciseNotes}
            multiline
          />
        </FitnessDisclosure>
        <FitnessNotice error message={error} />
        <FitnessAction
          label="Add exercise to workout"
          onPress={() => {
            if (addExercise()) setExerciseOpen(false);
          }}
        />
      </FitnessSheet>
      <FitnessMediaSourceSheet
        visible={mediaChooser}
        allowVideo
        onClose={() => setMediaChooser(false)}
        onChoose={asset => {
          void attach(asset);
        }}
      />
    </FitnessScreen>
  );
}
