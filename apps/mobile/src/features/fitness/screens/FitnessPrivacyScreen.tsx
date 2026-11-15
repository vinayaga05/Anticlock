import React, { useEffect, useRef, useState } from 'react';
import { useFitnessDraftGuard } from '../logging/useFitnessDraftGuard';
import { Alert, Share } from 'react-native';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessToggle,
} from '../components/FitnessControls';
import { FitnessMediaSourceSheet } from '../components/FitnessMediaSourceSheet';
import type { PickedFitnessMedia } from '../logging/fitnessMediaPicker';
import { StackActions, useNavigation } from '@react-navigation/native';
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
  const savedReminders = useRef(JSON.stringify(defaults));
  const hydrated = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [comparisonConsent, setComparisonConsent] = useState(false);
  const [mediaChooser, setMediaChooser] = useState(false);
  const pendingUpload = useRef<any>(null);
  useEffect(() => {
    if (profile.data && !hydrated.current) {
      const value = profile.data.profile?.assessment.reminders ?? defaults;
      savedReminders.current = JSON.stringify(value);
      setReminders(value);
      hydrated.current = true;
    }
  }, [profile.data]);
  async function saveReminders() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    try {
      assertActive();
      await mutation.mutateAsync({
        path: '/profile',
        method: 'PATCH',
        body: { reminders },
      });
      assertActive();
      savedReminders.current = JSON.stringify(reminders);
      setNotice(
        'Reminder preferences saved. Notification permission is managed in your device settings. Lock screen messages keep health details private.',
      );
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    }
  }
  async function exportData() {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return undefined;
    setError('');
    setBusy(true);
    try {
      assertActive();
      const result = await fitnessRequest<unknown>('/export');
      assertActive();
      await Share.share({
        title: 'My private fitness data',
        message: JSON.stringify(result, null, 2),
      });
      assertActive();
      setNotice(
        'Your export is ready in the system share sheet. Choose a destination you trust.',
      );
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
    } finally {
      if (guard.isActive()) setBusy(false);
    }
  }
  async function addProgressPhoto(asset?: PickedFitnessMedia) {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return false;
    setError('');
    setBusy(true);
    try {
      assertActive();
      if (!pendingUpload.current) {
        if (!asset) return false;
        pendingUpload.current = {
          uri: asset.uri,
          name: asset.name,
          byteSize: asset.byteSize,
          type: asset.type,
          purpose: 'progress',
          clientRequestId: newFitnessRequestId(),
          comparisonOptIn: comparisonConsent,
        };
      }
      const pending = pendingUpload.current;
      await uploadFitnessMedia(pending);
      assertActive();
      pendingUpload.current = null;
      setComparisonConsent(false);
      assertActive();
      await media.refetch();
      assertActive();
      setNotice(
        'Private progress photo saved. Only selected sharing can give an expert access.',
      );
      return true;
    } catch (e) {
      if (guard.isActive()) setError((e as Error).message);
      return false;
    } finally {
      if (guard.isActive()) setBusy(false);
    }
  }
  async function savePhotoComparison(id: string, comparisonOptIn: boolean) {
    const assertActive = guard.captureOperation();
    if (!guard.isActive()) return;
    try {
      assertActive();
      await mutation.mutateAsync({
        path: `/media/${id}`,
        method: 'PATCH',
        body: { comparisonOptIn },
      });
      assertActive();
      await media.refetch();
      assertActive();
    } catch (problem) {
      if (guard.isActive()) setError((problem as Error).message);
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
            const assertActive = guard.captureOperation();
            if (!guard.isActive()) return;
            setError('');
            setBusy(true);
            try {
              assertActive();
              await mutation.mutateAsync({ path: '/data', method: 'DELETE' });
              assertActive();
              client.removeQueries({ queryKey: ['fitness'] });
              pendingUpload.current = null;
              guard.allowExit(
                StackActions.replace('FitnessHome'),
                bumpFitnessDataEpoch,
              );
            } catch (e) {
              if (guard.isActive()) setError((e as Error).message);
            } finally {
              if (guard.isActive()) setBusy(false);
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
            if (accountClosing.current || !guard.isActive()) return;
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
              if (guard.isActive()) setError((e as Error).message);
            } finally {
              accountClosing.current = false;
              if (guard.isActive()) setBusy(false);
            }
          },
        },
      ],
    );
  }
  const guard = useFitnessDraftGuard({
    dirty:
      Boolean(pendingUpload.current) ||
      JSON.stringify(reminders) !== savedReminders.current,
    busy: busy || mutation.isPending,
    save: async () => {
      const assertActive = guard.captureOperation();
      assertActive();
      if (
        JSON.stringify(reminders) !== savedReminders.current &&
        !(await saveReminders())
      )
        return false;
      assertActive();
      if (pendingUpload.current) return addProgressPhoto();
      return true;
    },
    onError: setError,
  });
  const progressPhotos =
    media.data?.media.filter(item => item.purpose === 'progress') ?? [];
  const preferencesLoading = profile.isPending;
  return (
    <FitnessScreen
      title="Privacy & preferences"
      busy={mutation.isPending || busy || guard.saving}
      footer={
        <FitnessAction
          label={
            pendingUpload.current
              ? 'Retry private photo upload'
              : 'Add a private progress photo'
          }
          icon="camera"
          busy={busy}
          onPress={() => {
            if (pendingUpload.current) void addProgressPhoto();
            else setMediaChooser(true);
          }}
        />
      }
    >
      <FitnessCard tone="soft">
        <FitnessSection
          title="Private by default"
          caption="You choose what to share, and with whom."
        />
        <FitnessAction
          label="Review expert sharing"
          secondary
          onPress={() => nav.navigate('FitnessSharing', {})}
        />
      </FitnessCard>
      <FitnessSection
        title="Your progress photos"
        caption={
          media.data ? `${progressPhotos.length} saved privately` : undefined
        }
      />
      <FitnessToggle
        label="Use the next photo in private comparisons"
        detail="Off unless you choose it for this photo."
        value={comparisonConsent}
        onChange={setComparisonConsent}
      />
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
      ) : progressPhotos.length ? (
        progressPhotos.map(item => (
          <FitnessCard key={item.id}>
            <FitnessSection
              title="Private progress photo"
              caption={new Date(item.createdAt).toLocaleDateString()}
            />
            <FitnessPrivateMedia
              mediaId={item.id}
              onDelete={() => {
                if (guard.isActive()) void media.refetch();
              }}
            />
            <FitnessToggle
              label="Include in private comparisons"
              value={Boolean(item.comparisonOptIn)}
              onChange={value => {
                void savePhotoComparison(item.id, value);
              }}
            />
          </FitnessCard>
        ))
      ) : (
        <FitnessText muted>
          Your optional photos stay here, away from your public profile.
        </FitnessText>
      )}
      <FitnessDisclosure
        title="Reminders"
        subtitle={
          reminders.enabled ? 'Your chosen reminders' : 'Off until you choose'
        }
      >
        {preferencesLoading ? (
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
            <FitnessToggle
              label="Fitness reminders"
              value={reminders.enabled}
              onChange={value => setReminders(r => ({ ...r, enabled: value }))}
            />
            {reminders.enabled &&
              (
                [
                  ['workouts', 'Workout', 'workoutTime'],
                  ['meals', 'Meals', 'mealTime'],
                  ['water', 'Water', 'waterTime'],
                  ['habits', 'Habits', 'habitTime'],
                  ['weeklySummary', 'Weekly check-in', 'weeklySummaryTime'],
                ] as const
              ).map(([key, label, time]) => (
                <React.Fragment key={key}>
                  <FitnessToggle
                    label={label}
                    value={reminders[key]}
                    onChange={value =>
                      setReminders(r => ({ ...r, [key]: value }))
                    }
                  />
                  {reminders[key] && (
                    <FitnessDatePicker
                      label={`${label} time`}
                      mode="time"
                      value={reminders[time]}
                      onChange={value =>
                        setReminders(r => ({ ...r, [time]: value }))
                      }
                    />
                  )}
                </React.Fragment>
              ))}
            <FitnessText muted>
              Lock-screen messages keep health details private. Permissions are
              managed in device Settings.
            </FitnessText>
            <FitnessAction
              label="Save reminder preferences"
              secondary
              busy={mutation.isPending}
              onPress={() => {
                void saveReminders();
              }}
            />
          </FitnessCard>
        )}
      </FitnessDisclosure>
      {!!media.data?.media.some(item => item.purpose !== 'progress') && (
        <FitnessDisclosure
          title="Other private attachments"
          subtitle="Includes files not linked to an entry"
        >
          {media.data.media
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
                    if (guard.isActive()) void media.refetch();
                  }}
                />
              </FitnessCard>
            ))}
        </FitnessDisclosure>
      )}
      <FitnessDisclosure
        title="Your data & account"
        subtitle="Export, start over or close your account"
      >
        <FitnessAction
          label="Edit my assessment"
          secondary
          onPress={() => nav.navigate('FitnessAssessment')}
        />
        <FitnessText muted>
          Exports include your private assessment and journal. Choose a
          destination you trust.
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
        <FitnessAction
          label="Delete all my fitness data"
          destructive
          disabled={busy || mutation.isPending}
          onPress={deleteData}
        />
        <FitnessAction
          label="Close my Anticlock account"
          destructive
          disabled={busy || mutation.isPending}
          onPress={closeAccount}
        />
      </FitnessDisclosure>
      <FitnessNotice error message={error} />
      <FitnessNotice message={notice} />
      <FitnessMediaSourceSheet
        visible={mediaChooser}
        onClose={() => setMediaChooser(false)}
        onChoose={asset => {
          void addProgressPhoto(asset);
        }}
      />
    </FitnessScreen>
  );
}
