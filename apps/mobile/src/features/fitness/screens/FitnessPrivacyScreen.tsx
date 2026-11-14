import React, { useEffect, useRef, useState } from 'react';
import { Alert, Share } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { FitnessAssessment, FitnessProfile } from '@anticlock/contracts';
import {
  fitnessRequest,
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import { uploadFitnessMedia } from '../fitnessMedia';
import { FitnessPrivateMedia } from '../components/FitnessPrivateMedia';
import { bumpFitnessDataEpoch } from '../fitnessSession';
import { useAuth } from '@/shared/context/AuthProvider';
import { closeFitnessAccount } from '../api/fitnessAccount';
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

type Reminders = NonNullable<FitnessAssessment['reminders']>;
const defaults: Reminders = {
  enabled: false,
  workouts: false,
  meals: false,
  water: false,
  habits: false,
  weeklySummary: false,
};
type PrivateMedia = {
  id: string;
  kind: 'image' | 'video';
  purpose: 'progress' | 'meal' | 'workout';
  comparisonOptIn?: boolean;
  createdAt: string;
};
export function FitnessPrivacyScreen() {
  const { user, logout } = useAuth();
  const accountClosing = useRef(false);
  const nav = useNavigation<any>();
  const client = useQueryClient();
  const profile = useFitnessQuery<{ profile: FitnessProfile | null }>(
    '/profile',
  );
  const media = useFitnessQuery<{ media: PrivateMedia[] }>('/media');
  const mutation = useFitnessMutation();
  const [reminders, setReminders] = useState(defaults);
  const hydrated = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [comparisonConsent, setComparisonConsent] = useState(false);
  const pendingUpload = useRef<any>(null);
  useEffect(() => {
    if (profile.data && !hydrated.current) {
      setReminders(profile.data.profile?.assessment.reminders ?? defaults);
      hydrated.current = true;
    }
  }, [profile.data]);
  async function saveReminders() {
    setError('');
    try {
      await mutation.mutateAsync({
        path: '/profile',
        method: 'PATCH',
        body: { reminders },
      });
      setNotice(
        'Reminder preferences saved. Notification permission is managed in your device settings. Lock screen messages keep health details private.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function exportData() {
    setError('');
    setBusy(true);
    try {
      const result = await fitnessRequest<unknown>('/export');
      await Share.share({
        title: 'My private fitness data',
        message: JSON.stringify(result, null, 2),
      });
      setNotice(
        'Your export is ready in the system share sheet. Choose a destination you trust.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addProgressPhoto() {
    setError('');
    setBusy(true);
    try {
      if (!pendingUpload.current) {
        const selected = await launchImageLibrary({
          mediaType: 'photo',
          selectionLimit: 1,
        });
        if (selected.didCancel) return;
        const asset = selected.assets?.[0];
        if (selected.errorCode || !asset?.uri || !asset.type)
          throw new Error(selected.errorMessage || 'Choose a readable photo.');
        pendingUpload.current = {
          uri: asset.uri,
          name: asset.fileName ?? 'progress.jpg',
          type: asset.type,
          purpose: 'progress',
          clientRequestId: newFitnessRequestId(),
          comparisonOptIn: comparisonConsent,
        };
      }
      await uploadFitnessMedia(pendingUpload.current);
      pendingUpload.current = null;
      await media.refetch();
      setNotice(
        'Private progress photo saved. Only selected sharing can give an expert access.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function deleteData() {
    Alert.alert(
      'Delete all fitness data?',
      'This permanently removes your assessment, plans, food library, journal, private fitness media and fitness sharing consents. Consultation bookings and chat belong to their own services and remain available.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Delete fitness data',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setBusy(true);
            try {
              await mutation.mutateAsync({ path: '/data', method: 'DELETE' });
              client.removeQueries({ queryKey: ['fitness'] });
              nav.replace('FitnessHome');
              bumpFitnessDataEpoch();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }
  function closeAccount() {
    Alert.alert(
      'Close your Anticlock account?',
      'This closes your account, signs you out and deletes your Fitness assessment, plans, journal, private Fitness media and sharing permissions. Booking, chat and other records may be retained by those services. Account closure cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Close my account',
          style: 'destructive',
          onPress: async () => {
            if (accountClosing.current) return;
            accountClosing.current = true;
            setError('');
            setBusy(true);
            try {
              await closeFitnessAccount(user?.id, {
                logout,
                clearPrivateState: () => {
                  void client.cancelQueries({ queryKey: ['fitness'] });
                  client.removeQueries({ queryKey: ['fitness'] });
                  bumpFitnessDataEpoch();
                },
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              accountClosing.current = false;
              setBusy(false);
            }
          },
        },
      ],
    );
  }
  return (
    <FitnessScreen
      busy={mutation.isPending || busy}
      title="Private by choice"
      subtitle="You control your data, the reminders you receive, and every piece you share."
    >
      <FitnessCard tone="soft">
        <FitnessSection title="Your space stays yours" />
        <FitnessText>
          Your assessment, health context, logs and fitness media do not appear
          on your public profile or Clips. An expert sees only items you
          explicitly select and approve. You can revoke sharing immediately.
        </FitnessText>
        <FitnessAction
          label="Review expert sharing"
          secondary
          onPress={() => nav.navigate('FitnessSharing', {})}
        />
        <FitnessAction
          label="Edit my assessment"
          secondary
          onPress={() => nav.navigate('FitnessAssessment')}
        />
      </FitnessCard>
      <FitnessSection
        title="Gentle reminders"
        caption="Off until you choose. These are your current saved settings."
      />
      {profile.isPending ? (
        <FitnessLoading />
      ) : profile.isError ? (
        <>
          <FitnessNotice error message={profile.error.message} />
          <FitnessAction
            label="Retry preferences"
            secondary
            onPress={() => {
              void profile.refetch();
            }}
          />
        </>
      ) : (
        <FitnessCard>
          {(
            [
              'enabled',
              'workouts',
              'meals',
              'water',
              'habits',
              'weeklySummary',
            ] as const
          ).map(key => (
            <FitnessChoices
              key={key}
              label={
                {
                  enabled: 'Enable fitness reminders',
                  workouts: 'Workout reminders',
                  meals: 'Meal reminders',
                  water: 'Water reminders',
                  habits: 'Habit reminders',
                  weeklySummary: 'Weekly summary',
                }[key]
              }
              options={['Off', 'On']}
              selected={reminders[key] ? 'On' : 'Off'}
              onChange={v =>
                setReminders(current => ({ ...current, [key]: v === 'On' }))
              }
            />
          ))}
          {(
            [
              'workoutTime',
              'mealTime',
              'waterTime',
              'habitTime',
              'weeklySummaryTime',
            ] as const
          ).map(key => (
            <FitnessField
              key={key}
              label={
                {
                  workoutTime: 'Workout time',
                  mealTime: 'Meal time',
                  waterTime: 'Water time',
                  habitTime: 'Habit time',
                  weeklySummaryTime: 'Weekly summary time',
                }[key]
              }
              value={reminders[key] ?? ''}
              placeholder="HH:mm, e.g. 08:30"
              onChangeText={value =>
                setReminders(current => ({
                  ...current,
                  [key]: value || undefined,
                }))
              }
              hint="Your assessment timezone is used."
            />
          ))}
          <FitnessAction
            label="Save reminder preferences"
            busy={mutation.isPending}
            onPress={() => {
              void saveReminders();
            }}
          />
        </FitnessCard>
      )}
      <FitnessCard>
        <FitnessSection
          title="Progress photos, on your terms"
          caption="Optional private photos. No body analysis or automatic public sharing."
        />
        <FitnessChoices
          label="Photo comparison"
          options={['Allow this photo in my private comparison view']}
          selected={
            comparisonConsent
              ? ['Allow this photo in my private comparison view']
              : []
          }
          multiple
          onChange={value => setComparisonConsent(value.length > 0)}
        />
        <FitnessAction
          label={
            pendingUpload.current
              ? 'Retry private photo upload'
              : 'Choose & upload a private progress photo'
          }
          icon="camera"
          secondary
          busy={busy}
          onPress={() => {
            void addProgressPhoto();
          }}
        />
      </FitnessCard>
      {media.isPending ? (
        <FitnessLoading />
      ) : media.isError ? (
        <>
          <FitnessNotice error message={media.error.message} />
          <FitnessAction
            label="Retry private media"
            secondary
            onPress={() => {
              void media.refetch();
            }}
          />
        </>
      ) : media.data?.media.filter(item => item.purpose === 'progress')
          .length ? (
        media.data.media
          .filter(item => item.purpose === 'progress')
          .map(item => (
            <FitnessCard key={item.id}>
              <FitnessSection
                title="Private progress photo"
                caption={new Date(item.createdAt).toLocaleDateString()}
              />
              <FitnessPrivateMedia
                mediaId={item.id}
                onDelete={() => {
                  void media.refetch();
                }}
              />
              <FitnessText muted>
                {item.comparisonOptIn
                  ? 'Included in your private comparison view.'
                  : 'Photo comparison is off for this photo.'}
              </FitnessText>
              <FitnessAction
                label={
                  item.comparisonOptIn
                    ? 'Turn comparison off'
                    : 'Allow in my private comparisons'
                }
                secondary
                busy={mutation.isPending}
                onPress={async () => {
                  try {
                    await mutation.mutateAsync({
                      path: `/media/${item.id}`,
                      method: 'PATCH',
                      body: { comparisonOptIn: !item.comparisonOptIn },
                    });
                    await media.refetch();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            </FitnessCard>
          ))
      ) : (
        <FitnessText muted>No private progress photos yet.</FitnessText>
      )}
      {!!media.data?.media.some(item => item.purpose !== 'progress') && (
        <FitnessSection
          title="Your other private attachments"
          caption="Including uploads you chose not to attach to a journal entry. Delete any file here."
        />
      )}
      {media.data?.media
        .filter(item => item.purpose !== 'progress')
        .map(item => (
          <FitnessCard key={item.id}>
            <FitnessSection
              title={`Private ${item.purpose} ${
                item.kind === 'video' ? 'video' : 'photo'
              }`}
              caption={new Date(item.createdAt).toLocaleDateString()}
            />
            <FitnessPrivateMedia
              mediaId={item.id}
              onDelete={() => {
                void media.refetch();
              }}
            />
          </FitnessCard>
        ))}
      <FitnessCard>
        <FitnessSection title="Take your data with you" />
        <FitnessText muted>
          Your export includes private assessment and journal details. The
          system share sheet lets you choose where to save it.
        </FitnessText>
        <FitnessAction
          label="Export my private fitness data"
          secondary
          icon="share"
          busy={busy}
          onPress={() => {
            void exportData();
          }}
        />
      </FitnessCard>
      <FitnessCard>
        <FitnessSection title="Start over" />
        <FitnessText muted>
          Delete all fitness data from this account. This cannot be undone.
        </FitnessText>
        <FitnessAction
          label="Delete all my fitness data"
          destructive
          disabled={busy || mutation.isPending}
          onPress={deleteData}
        />
      </FitnessCard>
      <FitnessCard>
        <FitnessSection title="Close your account" />
        <FitnessText muted>
          Account closure signs you out and deletes your Fitness data. Booking,
          chat and other records may remain with those services.
        </FitnessText>
        <FitnessAction
          label="Close my Anticlock account"
          destructive
          disabled={busy || mutation.isPending}
          onPress={closeAccount}
        />
      </FitnessCard>
      <FitnessNotice error message={error} />
      <FitnessNotice message={notice} />
    </FitnessScreen>
  );
}
