import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { FitnessSummary } from '@anticlock/contracts';
import { AppIcon } from '@/shared/components/AppIcon';
import { useAuth } from '@/shared/context/AuthProvider';
import { useFitnessQuery } from '@/features/fitness/api/fitnessApi';
import {
  getFitnessDataEpoch,
  useFitnessDataEpoch,
} from '@/features/fitness/fitnessSession';
import {
  fitnessTimezone,
  localFitnessDate,
} from '@/features/fitness/fitnessModel';
import { buildFitnessSettingsModel } from './fitnessSettingsModel';

/** Keep private snapshots separate across accounts and fitness-data deletion. */
export function FitnessSettingsCard({ onPress }: { onPress: () => void }) {
  const { user, loading } = useAuth();
  const epoch = useFitnessDataEpoch();
  return (
    <FitnessSettingsSnapshot
      key={`${user?.id ?? 'guest'}:${epoch}`}
      onPress={onPress}
      epoch={epoch}
      signedIn={Boolean(!loading && user && user.id !== 'temporary-guest')}
    />
  );
}
function FitnessSettingsSnapshot({
  onPress,
  epoch,
  signedIn,
}: {
  onPress: () => void;
  epoch: number;
  signedIn: boolean;
}) {
  const focused = useIsFocused();
  const [clock, setClock] = useState(() => ({
    date: localFitnessDate(),
    timezone: fitnessTimezone(),
  }));
  const { date, timezone } = clock;
  const refreshClock = useCallback(
    () =>
      setClock(previous => {
        const next = { date: localFitnessDate(), timezone: fitnessTimezone() };
        return next.date === previous.date &&
          next.timezone === previous.timezone
          ? previous
          : next;
      }),
    [],
  );
  const query = useFitnessQuery<FitnessSummary>(
    `/summary?date=${date}&timezone=${encodeURIComponent(timezone)}`,
    signedIn && focused,
    epoch,
  );
  useEffect(() => {
    if (!signedIn || !focused) return;
    const update = refreshClock;
    const timer = setInterval(update, 30000);
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 25);
    const midnightTimer = setTimeout(
      update,
      Math.max(1, nextMidnight.getTime() - Date.now()),
    );
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        update();
        if (
          signedIn &&
          focused &&
          date === localFitnessDate() &&
          timezone === fitnessTimezone()
        )
          void query.refetch();
      }
    });
    return () => {
      clearInterval(timer);
      clearTimeout(midnightTimer);
      listener.remove();
    };
  }, [refreshClock, signedIn, focused, date, timezone, query.refetch]);
  useFocusEffect(
    useCallback(() => {
      const today = localFitnessDate();
      refreshClock();
      if (signedIn && today === date && fitnessTimezone() === timezone)
        void query.refetch();
    }, [signedIn, date, timezone, epoch, query.refetch, refreshClock]),
  );
  const data =
    signedIn &&
    focused &&
    getFitnessDataEpoch() === epoch &&
    !query.isError &&
    query.data?.timezone === fitnessTimezone()
      ? query.data
      : undefined;
  const model = buildFitnessSettingsModel(data, localFitnessDate());
  const focus = !signedIn
    ? 'Your fitness space'
    : query.isPending
    ? 'Your daily focus'
    : query.isError
    ? 'Your fitness details'
    : model.focus;
  const focusNote = !signedIn
    ? 'Sign in to see your saved details.'
    : query.isPending
    ? 'Loading your saved plan…'
    : query.isError
    ? 'Open Fitness to try again.'
    : model.focusNote;
  const workoutEmpty =
    query.isPending && signedIn
      ? 'Loading your saved workout…'
      : query.isError
      ? 'Your saved workout could not be loaded.'
      : model.workoutEmpty;
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width - 32);
  const stacked = width < 330 || window.fontScale > 1.2;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const ringSize = width < 330 ? 112 : 140;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const scheduledSummary = model.exercises.length
    ? model.exercises
        .map(exercise => `${exercise.name}: ${exercise.detail}`)
        .join('. ')
    : workoutEmpty;
  const accessibility = [
    'Open Fitness Space',
    `Today's focus: ${focus}`,
    focusNote,
    `Scheduled workout: ${scheduledSummary}`,
    ...model.stats.map(stat => `${stat.label}: ${stat.value}`),
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <View
      testID="settings-fitness-card"
      onLayout={event => {
        if (event.nativeEvent.layout.width > 0)
          setWidth(event.nativeEvent.layout.width);
      }}
      style={styles.shell}
    >
      <Pressable
        testID="settings-open-fitness"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibility}
        accessibilityHint="Opens your personal Fitness Space with your plan, daily logs and progress."
        style={({ pressed }) => ({ gap: 10, opacity: pressed ? 0.83 : 1 })}
      >
        <View style={styles.heading}>
          <View style={styles.headingLabel}>
            <AppIcon name="fitness" size={17} color="#77E4AC" />
            <Text style={styles.title}>Fitness Space</Text>
          </View>
          <AppIcon name="arrow-right" size={19} color="#B4BFC7" />
        </View>
        <View style={styles.shortcuts}>
          {(
            [
              {
                label: 'My Plan',
                icon: 'dumbbell',
                color: '#71F5A9',
                fill: '#1D3B2E',
              },
              {
                label: 'Daily Logs',
                icon: 'clipboard-list',
                color: '#EBD298',
                fill: '#3B3020',
              },
              {
                label: 'Progress',
                icon: 'activity',
                color: '#ADD7FF',
                fill: '#243446',
              },
            ] as const
          ).map((item, index) => (
            <View
              key={item.label}
              style={[styles.shortcut, { borderColor: `${item.color}66` }]}
            >
              <Surface
                id={`${id}-shortcut-${index}`}
                color={item.color}
                fill={item.fill}
              />
              <View style={styles.shortcutIcon}>
                <AppIcon
                  name={item.icon}
                  size={23}
                  color={item.color}
                  strokeWidth={1.7}
                />
              </View>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.focus, { minHeight: ringSize + 28 }]}>
          <Surface id={`${id}-focus`} fill="#20252C" />
          <View style={styles.focusCopy}>
            <Text style={styles.sectionLabel}>Today's Focus</Text>
            <Text testID="settings-fitness-focus" style={styles.focusTitle}>
              {focus}
            </Text>
            {focusNote && <Text style={styles.note}>{focusNote}</Text>}
          </View>
          <View
            style={{
              width: ringSize,
              height: ringSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg
              width={ringSize}
              height={ringSize}
              style={StyleSheet.absoluteFill}
              accessible={false}
            >
              <Defs>
                <RadialGradient id={`${id}-halo`}>
                  <Stop offset="0" stopColor="#677583" stopOpacity={0.35} />
                  <Stop offset="1" stopColor="#1B2027" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 1}
                fill={`url(#${id}-halo)`}
              />
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 7}
                stroke="#4B525B"
                strokeWidth={7}
                fill="none"
              />
              <Circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 7}
                stroke="#9CA5AD"
                strokeWidth={7}
                fill="none"
                strokeDasharray={`${ringSize * 1.86} ${ringSize * 3.15}`}
                rotation={-90}
                origin={`${ringSize / 2},${ringSize / 2}`}
              />
            </Svg>
            {(!imageLoaded || imageFailed) && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { alignItems: 'center', justifyContent: 'center' },
                ]}
              >
                <AppIcon name="fitness" size={ringSize / 2} color="#AEBAC3" />
              </View>
            )}
            {!imageFailed && (
              <Image
                source={require('../../fitness/assets/fitness-torso.png')}
                accessibilityLabel="Decorative silver fitness torso illustration"
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageFailed(true)}
                style={{
                  width: ringSize - 26,
                  height: ringSize - 18,
                  opacity: imageLoaded ? 1 : 0,
                }}
              />
            )}
            {model.chestFocus && imageLoaded && !imageFailed && (
              <Svg
                width={ringSize - 26}
                height={ringSize - 18}
                style={{ position: 'absolute' }}
                accessible={false}
              >
                <Defs>
                  <RadialGradient id={`${id}-chest`}>
                    <Stop offset="0" stopColor="#FF765E" stopOpacity={0.75} />
                    <Stop offset="1" stopColor="#FF765E" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse
                  cx="50%"
                  cy="42%"
                  rx="36%"
                  ry="15%"
                  fill={`url(#${id}-chest)`}
                />
              </Svg>
            )}
          </View>
        </View>
        <View
          style={[styles.bottom, { flexDirection: stacked ? 'column' : 'row' }]}
        >
          <View style={styles.workout}>
            <Surface id={`${id}-workout`} fill="#20252C" />
            <Text style={styles.sectionLabel}>Scheduled Workout</Text>
            {model.exercises.length ? (
              model.exercises.map((exercise, index) => (
                <View key={`${index}-${exercise.name}`} style={{ gap: 4 }}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>{workoutEmpty}</Text>
            )}
          </View>
          <View style={styles.statsPanel}>
            <Surface id={`${id}-stats`} fill="#20252C" />
            <Text style={styles.sectionLabel}>Key Stats</Text>
            <View style={styles.stats}>
              {model.stats.map(stat => (
                <View key={stat.label} style={styles.stat}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text
                    testID={`fitness-stat-${stat.label}`}
                    style={styles.statValue}
                  >
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <View style={styles.status}>
            {query.isPending && signedIn ? (
              <ActivityIndicator size="small" color="#80DDAA" />
            ) : (
              <AppIcon name="lock" size={12} color="#A4B1BA" />
            )}
            <Text style={styles.footerText}>
              {!signedIn
                ? 'Sign in for your private fitness details'
                : query.isPending
                ? 'Opening your saved fitness details…'
                : query.isError
                ? 'Details unavailable · open Fitness to retry'
                : 'Your private plan & saved activity'}
            </Text>
          </View>
          <Text style={styles.enter}>Open Fitness</Text>
        </View>
      </Pressable>
    </View>
  );
}
function Surface({
  id,
  fill,
  color = '#8395A7',
}: {
  id: string;
  fill: string;
  color?: string;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
      accessible={false}
    >
      <Defs>
        <LinearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={fill} />
          <Stop offset="1" stopColor="#171B21" />
        </LinearGradient>
        <RadialGradient id={`${id}-glow`} cx="35%" cy="0%" r="90%">
          <Stop offset="0" stopColor={color} stopOpacity={0.12} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={17} fill={`url(#${id}-base)`} />
      <Rect width="100%" height="100%" rx={17} fill={`url(#${id}-glow)`} />
    </Svg>
  );
}
const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0D1215',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2B353D',
    padding: 11,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 3,
    paddingTop: 2,
    paddingBottom: 3,
  },
  headingLabel: { flexDirection: 'row', gap: 8, alignItems: 'center', flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#F5F7F8', flexShrink: 1 },
  shortcuts: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  shortcut: {
    flex: 1,
    minWidth: 70,
    minHeight: 76,
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shortcutIcon: { alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#F5F7F8',
    textAlign: 'center',
  },
  focus: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2B323B',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  focusCopy: { flex: 1, minWidth: 0, gap: 10 },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#C5CCD1',
  },
  focusTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  note: { fontSize: 11, lineHeight: 16, color: '#B3BEC7' },
  bottom: { gap: 8, alignItems: 'stretch' },
  workout: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2B323B',
    padding: 11,
    gap: 13,
    overflow: 'hidden',
  },
  exerciseName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#F3F5F7',
  },
  exerciseDetail: { fontSize: 12, lineHeight: 18, color: '#B7C2CA' },
  empty: { fontSize: 13, lineHeight: 19, color: '#C0CBD2' },
  statsPanel: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2B323B',
    padding: 10,
    gap: 9,
    overflow: 'hidden',
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#58616B',
    backgroundColor: '#1A2026',
    padding: 7,
    gap: 3,
  },
  statLabel: { fontSize: 10, lineHeight: 14, color: '#C3CDD4' },
  statValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 9,
    padding: 3,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 130,
  },
  footerText: { fontSize: 10, lineHeight: 15, color: '#B3C0C9', flexShrink: 1 },
  enter: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#A0E6BB' },
});
