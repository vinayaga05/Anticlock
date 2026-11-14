import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  FitnessConsent,
  FitnessSharingScope,
  FitnessShareChoice,
} from '@anticlock/contracts';
import { useFitnessMutation, useFitnessQuery } from '../../api/fitnessApi';
import {
  FitnessAction,
  FitnessCard,
  FitnessEmpty,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
  useFitnessColors,
} from '../../components/FitnessUI';

export const FITNESS_SCOPE_LABELS: Record<FitnessSharingScope, string> = {
  profile: 'Profile basics',
  goals: 'Goals and target',
  health: 'Private health details',
  workouts: 'Selected workouts',
  meals: 'Selected meals',
  progress: 'Selected progress entries',
  media: 'Selected private photos or videos',
  plan_write: 'Allow plan revisions',
};
const DETAILS: Partial<Record<FitnessSharingScope, string>> = {
  profile:
    'Age, height, weight, activity, exercise and food preferences, equipment and availability. Your date of birth is excluded.',
  goals: 'Your chosen goals, target weight and target date.',
  health:
    'Only choose this if you want to share saved conditions, medications, injuries, pregnancy, breastfeeding, allergies and restrictions.',
  plan_write:
    'Lets this assigned expert read your complete saved plan and save new versions in their professional role. You can review every version.',
};
const choiceScope = (type?: string): FitnessSharingScope | undefined =>
  ((
    {
      profile: 'profile',
      workout: 'workouts',
      meal: 'meals',
      progress: 'progress',
      media: 'media',
    } as Record<string, FitnessSharingScope>
  )[type ?? '']);
export function FitnessSharingScreen() {
  const route = useRoute<any>(),
    nav = useNavigation<any>(),
    colors = useFitnessColors();
  const providerId = route.params?.providerId as string | undefined;
  const consents = useFitnessQuery<{ consents: FitnessConsent[] }>('/consents');
  const choices = useFitnessQuery<{ choices: FitnessShareChoice[] }>(
    '/share-choices',
    Boolean(providerId),
  );
  const mutation = useFitnessMutation();
  const [scopes, setScopes] = useState<FitnessSharingScope[]>([]),
    [ids, setIds] = useState<string[]>([]),
    [notice, setNotice] = useState<string | null>(null);
  const dirty = useRef(false);
  const active = consents.data?.consents.find(
    c => c.providerId === providerId && c.status === 'active',
  );
  useEffect(() => {
    dirty.current = false;
    setScopes([]);
    setIds([]);
    setNotice(null);
  }, [providerId]);
  useEffect(() => {
    if (dirty.current || !consents.data || !choices.data) return;
    const selected = choiceScope(route.params?.resourceType);
    const resourceId = route.params?.resourceId;
    const resource = choices.data.choices.find(
      c => c.id === resourceId && c.scope === selected,
    );
    setScopes([
      ...new Set([
        ...(active?.scopes ?? []),
        ...(selected && (!resourceId || resource) ? [selected] : []),
      ]),
    ]);
    setIds([
      ...new Set([
        ...(active?.resourceIds ?? []),
        ...(resource ? [resource.id] : []),
      ]),
    ]);
  }, [
    consents.data,
    choices.data,
    active,
    route.params?.resourceType,
    route.params?.resourceId,
  ]);
  const toggleScope = (scope: FitnessSharingScope) => {
    dirty.current = true;
    setScopes(current =>
      current.includes(scope)
        ? current.filter(s => s !== scope)
        : [...current, scope],
    );
  };
  const toggleId = (choice: FitnessShareChoice) => {
    dirty.current = true;
    const next = ids.includes(choice.id)
      ? ids.filter(id => id !== choice.id)
      : [...ids, choice.id];
    setIds(next);
    const stillSelected = choices.data?.choices.some(
      c => c.scope === choice.scope && next.includes(c.id),
    );
    setScopes(current =>
      stillSelected
        ? current.includes(choice.scope)
          ? current
          : [...current, choice.scope]
        : current.filter(s => s !== choice.scope),
    );
  };
  const save = () => {
    if (!providerId || !scopes.length) return;
    const resourceIds = ids.filter(id =>
      choices.data?.choices.some(c => c.id === id && scopes.includes(c.scope)),
    );
    if (
      scopes.some(
        s =>
          ['workouts', 'meals', 'progress', 'media'].includes(s) &&
          !choices.data?.choices.some(
            c => c.scope === s && resourceIds.includes(c.id),
          ),
      )
    ) {
      setNotice(
        'Select an individual entry for each selected log or media permission.',
      );
      return;
    }
    Alert.alert(
      'Confirm exactly what you share',
      `${
        route.params?.providerName ?? active?.providerName ?? 'This expert'
      } will receive:\n${scopes
        .map(s => '• ' + FITNESS_SCOPE_LABELS[s])
        .join('\n')}\n${
        resourceIds.length
      } selected entries. You can revoke access at any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm sharing',
          onPress: () =>
            void mutation
              .mutateAsync({
                path: `/consents/${providerId}`,
                method: 'PUT',
                body: { scopes, resourceIds, confirmed: true },
              })
              .then(() => {
                dirty.current = false;
                setNotice(
                  'Sharing permissions saved. Only your chosen information is available.',
                );
              })
              .catch(() => undefined),
        },
      ],
    );
  };
  const revoke = (id: string) =>
    Alert.alert(
      'Revoke fitness access?',
      'New reads and plan revisions will stop immediately. Information already seen by the expert cannot be recalled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke access',
          style: 'destructive',
          onPress: () =>
            void mutation
              .mutateAsync({ path: `/consents/${id}`, method: 'DELETE' })
              .then(() => {
                setScopes([]);
                setIds([]);
                dirty.current = false;
                setNotice('Fitness access revoked.');
              })
              .catch(() => undefined),
        },
      ],
    );
  const select = (
    label: string,
    checked: boolean,
    onPress: () => void,
    detail?: string,
  ) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        minHeight: 48,
        padding: 12,
        borderWidth: 1,
        borderColor: checked ? colors.accent : colors.line,
        borderRadius: 14,
        gap: 5,
        backgroundColor: checked ? colors.soft : colors.surface,
      }}
    >
      <FitnessText>
        {checked ? '✓  ' : '○  '}
        {label}
      </FitnessText>
      {detail && <FitnessText muted>{detail}</FitnessText>}
    </Pressable>
  );
  return (
    <FitnessScreen
      title="You're in control"
      subtitle="Fitness information stays private until you choose an expert, choose the information, and confirm. A current booking or assignment is also required."
    >
      {consents.isLoading ? (
        <FitnessLoading />
      ) : consents.error ? (
        <FitnessEmpty
          title="Sharing could not be loaded"
          message={consents.error.message}
          action="Try again"
          onPress={() => void consents.refetch()}
        />
      ) : (
        <>
          {providerId ? (
            <>
              <FitnessCard>
                <FitnessSection
                  title={
                    route.params?.providerName ??
                    active?.providerName ??
                    'Selected expert'
                  }
                  caption="Choose each permission separately."
                />
                {(
                  [
                    'profile',
                    'goals',
                    'health',
                    'plan_write',
                  ] as FitnessSharingScope[]
                ).map(scope => (
                  <View key={scope}>
                    {select(
                      FITNESS_SCOPE_LABELS[scope],
                      scopes.includes(scope),
                      () => toggleScope(scope),
                      DETAILS[scope],
                    )}
                  </View>
                ))}
              </FitnessCard>
              <FitnessSection
                title="Choose individual entries"
                caption="Sharing a workout or meal does not automatically share its attached photos or videos. Choose media separately."
              />
              {choices.isLoading ? (
                <FitnessLoading />
              ) : choices.error ? (
                <FitnessEmpty
                  title="Entries could not be loaded"
                  message={choices.error.message}
                  action="Try again"
                  onPress={() => void choices.refetch()}
                />
              ) : choices.data?.choices.length ? (
                <FitnessCard>
                  {choices.data.choices.map(choice => (
                    <View key={choice.id}>
                      {select(
                        `${choice.label}${
                          choice.date ? ' · ' + choice.date : ''
                        }`,
                        ids.includes(choice.id) &&
                          scopes.includes(choice.scope),
                        () => toggleId(choice),
                      )}
                    </View>
                  ))}
                </FitnessCard>
              ) : (
                <FitnessEmpty
                  title="No saved entries yet"
                  message="Log a workout, meal or progress entry to share it individually."
                />
              )}
              <FitnessAction
                label="Review and confirm sharing"
                disabled={!scopes.length || choices.isError}
                busy={mutation.isPending}
                onPress={save}
              />
              {active && (
                <FitnessAction
                  label="Revoke this expert's access"
                  destructive
                  onPress={() => revoke(providerId)}
                />
              )}
            </>
          ) : (
            <FitnessAction
              label="Choose an expert to share with"
              onPress={() => nav.navigate('FitnessExperts')}
            />
          )}
          <FitnessNotice message={mutation.error?.message} error />
          <FitnessNotice message={notice} />
          <FitnessSection title="Your sharing permissions" />
          {consents.data?.consents
            .filter(
              (c, index, all) =>
                all.findIndex(x => x.providerId === c.providerId) === index,
            )
            .map(consent => (
              <FitnessCard key={consent.id}>
                <FitnessSection title={consent.providerName} />
                <FitnessText muted>
                  {consent.status === 'active'
                    ? consent.scopes
                        .map(s => FITNESS_SCOPE_LABELS[s])
                        .join(' · ')
                    : 'Access revoked'}
                </FitnessText>
                {consent.status === 'active' && (
                  <>
                    <FitnessText muted>
                      {consent.resourceIds.length} selected entries
                    </FitnessText>
                    <FitnessAction
                      secondary
                      label="Edit permissions"
                      onPress={() =>
                        nav.navigate('FitnessSharing', {
                          providerId: consent.providerId,
                          providerName: consent.providerName,
                        })
                      }
                    />
                    <FitnessAction
                      label="Revoke access"
                      destructive
                      onPress={() => revoke(consent.providerId)}
                    />
                  </>
                )}
              </FitnessCard>
            ))}
        </>
      )}
    </FitnessScreen>
  );
}
