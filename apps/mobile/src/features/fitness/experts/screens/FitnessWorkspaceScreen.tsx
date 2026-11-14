import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  FitnessPlanContent,
  FitnessWorkspace,
  FitnessWorkspaceClient,
} from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { createOrGetChannel } from '@/shared/api/messagesClient';
import {
  assertFitnessSession,
  fitnessSession,
  useFitnessMutation,
  useFitnessQuery,
} from '../../api/fitnessApi';
import {
  FitnessAction,
  FitnessCard,
  FitnessEmpty,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../../components/FitnessUI';
import { FitnessPrivateMedia } from '../../components/FitnessPrivateMedia';
import { FitnessPlanEditor } from '../components/FitnessPlanEditor';
import { FITNESS_SCOPE_LABELS } from './FitnessSharingScreen';

type ClientDetail = {
  client: FitnessWorkspaceClient;
  shared: Array<{ scope: string; id: string | null; data: unknown }>;
  plan: FitnessPlanContent | null;
};
const human = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
const object = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const PROFILE_LABELS: Record<string, string> = {
  age: 'Age',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  units: 'Preferred units',
  activityLevel: 'Activity level',
  experience: 'Training experience',
  exercisePreferences: 'Preferred exercise',
  foodPreferences: 'Food preferences',
  equipment: 'Available equipment',
  availableDays: 'Available days',
  preferredTimes: 'Preferred times',
  sessionMinutes: 'Session length (minutes)',
  goals: 'Wellness goals',
  targetWeightKg: 'Target weight (kg)',
  targetDate: 'Target date',
  medicalConditions: 'Conditions shared by your client',
  medications: 'Medications shared by your client',
  injuries: 'Injuries',
  mobility: 'Mobility considerations',
  pregnant: 'Pregnancy disclosed',
  breastfeeding: 'Breastfeeding disclosed',
  eatingDisorderRisk: 'Eating disorder concern disclosed',
  clinicalReviewRequired: 'Clinical review requested',
  allergies: 'Allergies',
  restrictions: 'Dietary restrictions',
};
const display = (value: unknown): string =>
  Array.isArray(value)
    ? value
        .map(item =>
          typeof item === 'number'
            ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item] ??
              String(item)
            : human(String(item)),
        )
        .join(' · ')
    : typeof value === 'boolean'
    ? value
      ? 'Yes'
      : 'No'
    : human(String(value));
function SharedEntry({ scope, value }: { scope: string; value: unknown }) {
  const source = object(value);
  if (['profile', 'goals', 'health'].includes(scope))
    return (
      <View style={{ gap: 12 }}>
        {Object.entries(PROFILE_LABELS)
          .filter(([key]) => key in source)
          .map(([key, label]) => (
            <View key={key}>
              <FitnessText muted>{label}</FitnessText>
              <FitnessText>{display(source[key])}</FitnessText>
            </View>
          ))}
      </View>
    );
  if (scope === 'media') return null;
  const data = object(source.data),
    date = typeof source.date === 'string' ? source.date : '';
  if (scope === 'workouts')
    return (
      <View style={{ gap: 12 }}>
        <FitnessText>{String(data.name ?? 'Shared workout')}</FitnessText>
        <FitnessText muted>
          {date} · {human(String(data.status ?? ''))}
          {data.durationMinutes ? ` · ${data.durationMinutes} min` : ''}
        </FitnessText>
        {(Array.isArray(data.exercises) ? data.exercises : []).map(
          (exercise: any, index: number) => (
            <View key={index}>
              <FitnessText>{exercise.name}</FitnessText>
              {(Array.isArray(exercise.sets) ? exercise.sets : []).map(
                (set: any, i: number) => (
                  <FitnessText key={i} muted>
                    Set {i + 1}:{' '}
                    {[
                      set.reps !== undefined ? `${set.reps} reps` : null,
                      set.weightKg !== undefined ? `${set.weightKg} kg` : null,
                      set.durationSeconds !== undefined
                        ? `${set.durationSeconds}s`
                        : null,
                      set.distanceMetres !== undefined
                        ? `${set.distanceMetres}m`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </FitnessText>
                ),
              )}
              {exercise.notes && (
                <FitnessText muted>{exercise.notes}</FitnessText>
              )}
            </View>
          ),
        )}
        {data.notes && <FitnessText>{data.notes}</FitnessText>}
        {data.painNote && (
          <FitnessText>Client's comfort note: {data.painNote}</FitnessText>
        )}
        {data.helpRequested && (
          <FitnessText muted>Your client requested support.</FitnessText>
        )}
      </View>
    );
  if (scope === 'meals')
    return (
      <View style={{ gap: 12 }}>
        <FitnessText>
          {human(String(data.mealType ?? 'Meal'))} · {date}
        </FitnessText>
        {(Array.isArray(data.foods) ? data.foods : []).map(
          (food: any, index: number) => {
            const nutrients = object(food.nutrients),
              servings = Number(food.servings) || 1;
            return (
              <View key={index}>
                <FitnessText>
                  {food.name} · {servings} serving{servings === 1 ? '' : 's'}
                </FitnessText>
                <FitnessText muted>
                  {Math.round(Number(nutrients.calories ?? 0) * servings)} kcal
                  · Protein{' '}
                  {Math.round(Number(nutrients.proteinG ?? 0) * servings)}g ·
                  Carbs {Math.round(Number(nutrients.carbsG ?? 0) * servings)}g
                  · Fat {Math.round(Number(nutrients.fatG ?? 0) * servings)}g
                </FitnessText>
              </View>
            );
          },
        )}
        {data.estimate && (
          <FitnessText muted>
            This entry contains an editable estimate.
          </FitnessText>
        )}
        {data.notes && <FitnessText>{data.notes}</FitnessText>}
      </View>
    );
  if (scope === 'progress') {
    const kind = source.kind;
    const metric =
      kind === 'weight'
        ? `${data.weightKg} kg${
            data.waistCm ? ` · waist ${data.waistCm} cm` : ''
          }`
        : kind === 'water'
        ? `${data.amountMl} ml water`
        : kind === 'steps'
        ? `${data.count} steps`
        : kind === 'sleep'
        ? `${Math.floor(Number(data.durationMinutes) / 60)}h ${
            Number(data.durationMinutes) % 60
          }m sleep`
        : `${human(String(data.key ?? 'Habit'))} · ${
            data.completed ? 'Completed' : 'Not completed'
          }`;
    return (
      <View style={{ gap: 8 }}>
        <FitnessText>{metric}</FitnessText>
        <FitnessText muted>
          {date}
          {data.quality ? ` · ${human(String(data.quality))}` : ''}
        </FitnessText>
        {data.notes && <FitnessText>{data.notes}</FitnessText>}
      </View>
    );
  }
  return <FitnessText muted>This entry is unavailable.</FitnessText>;
}
export function FitnessWorkspaceScreen() {
  const nav = useNavigation<any>(),
    route = useRoute<any>();
  const { user } = useAuth();
  const workspace = useFitnessQuery<FitnessWorkspace>('/workspace');
  const [selected, setSelected] = useState<FitnessWorkspaceClient | null>(null);
  const [message, setMessage] = useState<string | null>(null),
    [chatBusy, setChatBusy] = useState(false);
  const detail = useFitnessQuery<ClientDetail>(
    selected
      ? `/workspace/${selected.providerId}/clients/${selected.userId}`
      : '/workspace/no-client',
    Boolean(selected),
  );
  const mutation = useFitnessMutation();
  const provider = workspace.data?.providers.find(
    p => p.id === selected?.providerId,
  );
  useEffect(() => {
    if (route.params?.clientId && !selected && workspace.data) {
      setSelected(
        workspace.data.clients.find(
          c =>
            c.userId === route.params.clientId &&
            (!route.params.providerId ||
              c.providerId === route.params.providerId),
        ) ?? null,
      );
    }
  }, [
    workspace.data,
    route.params?.clientId,
    route.params?.providerId,
    selected,
  ]);
  const chat = async (client: FitnessWorkspaceClient) => {
    setChatBusy(true);
    setMessage(null);
    try {
      const session = fitnessSession(user?.id);
      const channel = await createOrGetChannel(
        { id: client.userId, type: 'personal' },
        { id: client.providerId, type: 'business' },
      );
      assertFitnessSession(session);
      if (
        channel.profile.id !== client.userId ||
        channel.profile.type !== 'personal'
      )
        throw new Error(
          'The selected client conversation could not be confirmed.',
        );
      nav.navigate('Thread', {
        conversationId: channel.channelId,
        channelId: channel.channelId,
        profile: channel.profile,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Chat could not be opened.',
      );
    } finally {
      setChatBusy(false);
    }
  };
  return (
    <FitnessScreen
      busy={mutation.isPending || chatBusy}
      title="Your expert workspace"
      subtitle="Only your booked or assigned clients with active, explicit consent appear here."
    >
      {workspace.isLoading ? (
        <FitnessLoading />
      ) : workspace.error ? (
        <FitnessEmpty
          title="Workspace unavailable"
          message={workspace.error.message}
          action="Try again"
          onPress={() => void workspace.refetch()}
        />
      ) : !workspace.data?.providers.length ? (
        <FitnessEmpty
          title="For approved professionals"
          message="This workspace is available to approved trainers and nutritionists who manage their business. Find an expert for your own goals."
          action="Find an expert"
          onPress={() => nav.navigate('FitnessExperts')}
        />
      ) : (
        <>
          {workspace.data.providers.map(p => (
            <FitnessCard key={p.id}>
              <FitnessSection
                title={p.name}
                caption={
                  p.kind === 'trainer' ? 'Fitness trainer' : 'Nutritionist'
                }
              />
              <FitnessAction
                secondary
                label="Business profile & services"
                onPress={() =>
                  nav.navigate('BusinessProfile', { providerId: p.id })
                }
              />
              <FitnessAction
                secondary
                label="Bookings and classes"
                onPress={() => nav.navigate('MyBookings')}
              />
              {p.canPublish && (
                <>
                  <FitnessAction
                    label="Add a Clip"
                    onPress={() =>
                      nav.navigate('ClipComposer', {
                        publisherProfileId: p.id,
                        publisherProfileType: 'business',
                      })
                    }
                  />
                  <FitnessAction
                    secondary
                    label="Add a product"
                    onPress={() =>
                      nav.navigate('CreateExploreProduct', {
                        publisherProfileId: p.id,
                        publisherProfileType: 'business',
                      })
                    }
                  />
                  <FitnessAction
                    secondary
                    label="Add an event or class"
                    onPress={() =>
                      nav.navigate('CreateExploreEvent', {
                        publisherProfileId: p.id,
                        publisherProfileType: 'business',
                      })
                    }
                  />
                </>
              )}
            </FitnessCard>
          ))}
          <FitnessSection
            title="Consenting clients"
            caption="Health categories and individual entries are selected by each client."
          />
          {!workspace.data.clients.length ? (
            <FitnessEmpty
              title="No shared clients yet"
              message="A client must have a booking or assignment and choose what to share before you can view their fitness information."
            />
          ) : (
            workspace.data.clients.map(c => (
              <FitnessCard key={`${c.providerId}-${c.userId}`}>
                <FitnessSection title={c.displayName} />
                <FitnessText muted>
                  {c.scopes.map(s => FITNESS_SCOPE_LABELS[s]).join(' · ')}
                </FitnessText>
                <FitnessAction
                  label="View shared information"
                  onPress={() => {
                    setSelected(c);
                    setMessage(null);
                  }}
                />
                <FitnessAction
                  secondary
                  label="Chat with client"
                  busy={chatBusy}
                  onPress={() => void chat(c)}
                />
              </FitnessCard>
            ))
          )}
          {selected && (
            <>
              <FitnessSection
                title={`${selected.displayName}'s selected information`}
              />
              <FitnessAction
                secondary
                label="Reload sharing permissions"
                onPress={() => {
                  void detail.refetch();
                  void workspace.refetch();
                }}
              />
              {detail.isLoading ? (
                <FitnessLoading />
              ) : detail.error ? (
                <FitnessEmpty
                  title="Sharing unavailable"
                  message={detail.error.message}
                  action="Reload"
                  onPress={() => void detail.refetch()}
                />
              ) : (
                detail.data && (
                  <>
                    {detail.data.shared.length ? (
                      detail.data.shared.map((entry, index) => (
                        <FitnessCard
                          key={`${entry.scope}-${entry.id ?? index}`}
                        >
                          <FitnessSection
                            title={
                              FITNESS_SCOPE_LABELS[
                                entry.scope as keyof typeof FITNESS_SCOPE_LABELS
                              ] ?? human(entry.scope)
                            }
                          />
                          <SharedEntry scope={entry.scope} value={entry.data} />
                          {entry.scope === 'media' && entry.id && (
                            <FitnessPrivateMedia
                              mediaId={entry.id}
                              providerId={selected.providerId}
                            />
                          )}
                        </FitnessCard>
                      ))
                    ) : (
                      <FitnessEmpty
                        title="No entries shared"
                        message="Your client has not selected profile categories or individual entries."
                      />
                    )}
                    {detail.data.client.scopes.includes('plan_write') &&
                      !detail.data.client.plan && (
                        <FitnessEmpty
                          title="No current plan to revise"
                          message="Your client needs to complete or review their assessment and save a current plan before you can revise it. Earlier versions remain in their history."
                        />
                      )}
                    {detail.data.client.scopes.includes('plan_write') &&
                      detail.data.client.plan &&
                      detail.data.plan &&
                      provider && (
                        <FitnessPlanEditor
                          key={`${selected.providerId}:${selected.userId}:${detail.data.client.plan.version}`}
                          content={detail.data.plan}
                          version={detail.data.client.plan.version}
                          kind={provider.kind}
                          busy={mutation.isPending}
                          onPublish={async revision => {
                            await mutation.mutateAsync({
                              path: `/workspace/${
                                selected.providerId
                              }/clients/${selected.userId}/plans/${
                                detail.data!.client.plan!.id
                              }`,
                              method: 'PUT',
                              body: revision,
                            });
                            setMessage(
                              'The new version is saved. Your client can review the update.',
                            );
                            void detail.refetch();
                          }}
                        />
                      )}
                  </>
                )
              )}
            </>
          )}
          <FitnessNotice message={mutation.error?.message} error />
          <FitnessNotice message={message} />
          <FitnessSection title="Consultations" />
          {workspace.data.consultations.length ? (
            workspace.data.consultations.map(session => (
              <FitnessCard key={session.bookingId}>
                <FitnessSection title={session.clientName} />
                <FitnessText>
                  {new Date(session.startsAt).toLocaleString()} ·{' '}
                  {human(session.status)}
                </FitnessText>
                <FitnessAction
                  secondary
                  label="Open booking"
                  onPress={() =>
                    nav.navigate('BookingDetail', {
                      bookingId: session.bookingId,
                    })
                  }
                />
                {session.serviceMode === 'online' && (
                  <FitnessAction
                    disabled={!session.canJoin}
                    label={
                      session.canJoin
                        ? 'Join scheduled consultation'
                        : 'Call opens near the booked time'
                    }
                    onPress={() =>
                      nav.navigate('Call', {
                        mode: session.mode,
                        name: session.clientName,
                        bookingId: session.bookingId,
                        targetProfile: { id: session.userId, type: 'personal' },
                        viewerProfile: {
                          id: session.providerId,
                          type: 'business',
                        },
                      })
                    }
                  />
                )}
              </FitnessCard>
            ))
          ) : (
            <FitnessText muted>No consultations booked yet.</FitnessText>
          )}
        </>
      )}
    </FitnessScreen>
  );
}
