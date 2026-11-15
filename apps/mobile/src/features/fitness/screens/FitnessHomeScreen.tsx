import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  Droplets,
  Dumbbell,
  History,
  Leaf,
  LockKeyhole,
  Moon,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { FitnessSummary, FitnessTargets } from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import {
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from '../api/fitnessApi';
import {
  dayMetric,
  fitnessTimezone,
  localFitnessDate,
  numberLabel,
} from '../fitnessModel';
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
} from '../components/FitnessUI';
import {
  FitnessAvatar,
  FitnessIllustration,
  FitnessPhoto,
  FitnessRing,
} from '../components/FitnessVisuals';
import { fitnessRangeLabel } from '../components/FitnessTargetCards';
import { FitnessExpertHome } from '../experts/components/FitnessExpertHome';

export function FitnessHomeScreen() {
  const nav = useNavigation<any>();
  const c = useFitnessColors();
  const { user } = useAuth();
  const date = localFitnessDate();
  const query = useFitnessQuery<FitnessSummary>(
    `/summary?date=${date}&timezone=${encodeURIComponent(fitnessTimezone())}`,
  );
  const mutation = useFitnessMutation();
  const saving = React.useRef(false);
  const waterRequest = React.useRef<{
    owner: string;
    date: string;
    clientRequestId: string;
    data: { amountMl: number };
  } | null>(null);
  const [waterError, setWaterError] = React.useState<string | null>(null);
  React.useEffect(() => {
    waterRequest.current = null;
    setWaterError(null);
  }, [user?.id]);
  useFocusEffect(
    React.useCallback(() => {
      if (user && user.id !== 'temporary-guest') void query.refetch();
    }, [user?.id, date]),
  );
  const route = (name: string, params?: any) => nav.navigate(name, params);
  const data = query.data;
  const plan = data?.plan;
  const reviewRequired = Boolean(
    data?.profile?.baseline?.requiresProfessionalReview ||
      plan?.content.requiresProfessionalReview ||
      plan?.status === 'needs_review' ||
      data?.targetStatus === 'needs_review',
  );
  const safeTargets = reviewRequired ? null : data?.targets;
  const todayWorkout = reviewRequired
    ? undefined
    : plan?.content.workouts.find(
        w => w.day === new Date(`${data?.date ?? date}T12:00:00`).getDay(),
      );
  const workoutStatus = data?.todayWorkout;
  const completed = Boolean(
    workoutStatus &&
      workoutStatus.planned > 0 &&
      workoutStatus.completed >= workoutStatus.planned,
  );
  const workoutPercent =
    !reviewRequired && workoutStatus?.planned
      ? workoutStatus.completionPercent
      : null;
  const water = data ? dayMetric(data.today, 'waterMl') : null;
  const target = safeTargets?.waterMl;
  const waterPercent = rangeProgress(water, target);
  const name = user?.displayName?.trim().split(/\s+/)[0];
  const addGlass = async () => {
    if (!user || saving.current) return;
    saving.current = true;
    setWaterError(null);
    const attempt =
      waterRequest.current?.owner === user.id
        ? waterRequest.current
        : {
            owner: user.id,
            date: localFitnessDate(),
            clientRequestId: newFitnessRequestId(),
            data: { amountMl: 250 },
          };
    waterRequest.current = attempt;
    try {
      const { owner: _, ...body } = attempt;
      await mutation.mutateAsync({ path: '/logs/water', body });
      if (waterRequest.current === attempt) waterRequest.current = null;
    } catch (error) {
      setWaterError(
        error instanceof Error
          ? error.message
          : 'Water could not be saved. Try again.',
      );
    } finally {
      saving.current = false;
    }
  };
  if (!user || user.id === 'temporary-guest')
    return (
      <FitnessScreen title="Feel good, your way.">
        <FitnessPhoto kind="outdoor" />
        <FitnessEmpty
          title="A little better, daily."
          message="Sign in for your private plan and progress."
          action="Sign in"
          onPress={() => route('Login')}
        />
      </FitnessScreen>
    );
  return (
    <FitnessScreen
      title="Your daily rhythm"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fitness privacy and settings"
          onPress={() => route('FitnessPrivacy')}
          style={styles.iconButton}
        >
          <LockKeyhole size={21} color={c.accent} />
        </Pressable>
      }
    >
      {query.isPending && !data ? (
        <FitnessLoading />
      ) : query.isError && !data ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <FitnessIllustration kind="empty" size={148} />
          </View>
          <FitnessEmpty
            title="Let’s try that again"
            message={query.error.message}
            action="Try again"
            onPress={() => void query.refetch()}
          />
        </>
      ) : !data?.profile || data.profile.status === 'draft' ? (
        <>
          <FitnessPhoto kind="workout" style={{ height: 240 }}>
            <Text style={styles.photoEyebrow}>MADE AROUND YOU</Text>
            <Text style={styles.photoTitle}>
              {'Small steps.\nYour kind of progress.'}
            </Text>
          </FitnessPhoto>
          <FitnessSection
            title={
              data?.profile
                ? 'Welcome back. Let’s finish up.'
                : 'A plan that fits your life.'
            }
            caption="Your goals, your routine, your pace."
          />
          <View style={styles.featureRow}>
            {[
              { Icon: Dumbbell, label: 'Move' },
              { Icon: Leaf, label: 'Nourish' },
              { Icon: TrendingUp, label: 'Grow' },
            ].map(({ Icon, label }) => (
              <View
                key={label}
                style={[styles.feature, { backgroundColor: c.soft }]}
              >
                <Icon size={23} color={c.accent} />
                <Text style={{ color: c.ink, fontSize: 13, fontWeight: '500' }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          <FitnessAction
            label={data?.profile ? 'Continue assessment' : 'Let’s get started'}
            icon="arrow-right"
            onPress={() => route('FitnessAssessment')}
          />
          <Text style={[styles.small, { color: c.muted, textAlign: 'center' }]}>
            Five short steps · Private to you
          </Text>
        </>
      ) : (
        <>
          {query.isError && (
            <FitnessNotice
              error
              message="You’re viewing saved data. Refresh when you’re connected."
            />
          )}
          {query.isError && (
            <FitnessAction
              label="Refresh today"
              secondary
              compact
              onPress={() => void query.refetch()}
            />
          )}
          <View style={styles.greeting}>
            <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
              <Text style={[styles.date, { color: c.muted }]}>
                {new Date(`${data.date}T12:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: 'long', day: 'numeric', month: 'long' },
                )}
              </Text>
              <Text
                accessibilityRole="header"
                style={[styles.greetingTitle, { color: c.ink }]}
              >
                {name ? `Hello, ${name}.` : 'Hello, you.'}
              </Text>
              <FitnessText muted>Make a little room for yourself.</FitnessText>
            </View>
            <FitnessRing
              value={workoutPercent}
              size={66}
              strokeWidth={3}
              label={
                workoutPercent == null
                  ? 'Today’s workout progress has no scheduled comparison'
                  : `${numberLabel(
                      workoutPercent,
                      '%',
                    )} of today’s scheduled workouts complete`
              }
            >
              <FitnessAvatar
                uri={user.avatarUrl}
                name={user.displayName || 'Your profile'}
                size={48}
              />
            </FitnessRing>
          </View>
          {reviewRequired && (
            <View style={[styles.review, { backgroundColor: c.soft }]}>
              <Sparkles color={c.accent} size={22} />
              <View style={{ flex: 1, gap: 8 }}>
                <FitnessText>Let’s get expert guidance first.</FitnessText>
                <FitnessText muted>
                  Targets withheld for professional review. Your journal is
                  ready.
                </FitnessText>
                <Text
                  accessibilityRole="link"
                  onPress={() => route('FitnessExperts')}
                  style={{ color: c.accent, fontSize: 14, fontWeight: '600' }}
                >
                  Find a qualified expert →
                </Text>
              </View>
            </View>
          )}
          <FitnessPhoto
            kind={
              todayWorkout?.name.toLowerCase().includes('yoga')
                ? 'yoga'
                : todayWorkout
                ? 'strength'
                : 'outdoor'
            }
            style={{ height: 210 }}
          >
            <View style={styles.photoTag}>
              <Dumbbell size={14} color="#fff" />
              <Text style={styles.photoEyebrow}>
                {completed ? 'TODAY, COMPLETE' : 'TODAY’S MOVEMENT'}
              </Text>
            </View>
            <Text style={styles.photoTitle}>
              {todayWorkout?.name ??
                (!plan
                  ? 'Your starting point is saved.'
                  : reviewRequired
                  ? 'Move at your own pace.'
                  : 'Room to recharge.')}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {todayWorkout && <Clock3 size={15} color="#fff" />}
              <Text style={styles.photoCaption}>
                {todayWorkout
                  ? `${todayWorkout.durationMinutes} min${
                      data.profile.assessment.experience
                        ? ` · ${data.profile.assessment.experience}`
                        : ''
                    }`
                  : !plan
                  ? 'Create your starter wellness plan.'
                  : reviewRequired
                  ? 'Log your own activity.'
                  : 'No workout scheduled today.'}
              </Text>
            </View>
          </FitnessPhoto>
          <FitnessAction
            label={
              !plan
                ? 'Create my plan'
                : todayWorkout
                ? completed
                  ? 'View today’s workout'
                  : 'Start workout'
                : 'Log my own activity'
            }
            icon={!plan ? 'sparkles' : 'play'}
            onPress={() =>
              !plan
                ? route('FitnessPlan')
                : route(
                    'FitnessWorkout',
                    todayWorkout
                      ? {
                          planId: plan.id,
                          day: todayWorkout.day,
                          date: data.date,
                        }
                      : { date: data.date },
                  )
            }
          />
          {workoutStatus && !reviewRequired && workoutStatus.planned > 0 && (
            <Text style={[styles.small, { color: c.muted }]}>
              {workoutStatus.completed} of {workoutStatus.planned} scheduled
              workouts complete
              {data.today.recordedKinds?.includes('workout')
                ? ` · ${numberLabel(
                    dayMetric(data.today, 'workoutMinutes'),
                    ' min',
                  )} logged`
                : ''}
            </Text>
          )}
          <TodayNutrition
            day={data.today}
            targets={safeTargets}
            reviewRequired={reviewRequired}
            onAdd={() => route('FitnessMeals')}
          />
          <FitnessCard>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}
            >
              <FitnessRing
                value={waterPercent}
                size={70}
                strokeWidth={5}
                color={c.accent}
                label={
                  water === null
                    ? 'No water entry yet'
                    : `${water} ml logged${
                        target
                          ? ` of ${target.min}–${target.max} ml daily reference`
                          : ''
                      }`
                }
              >
                <Droplets size={26} strokeWidth={1.6} color={c.accent} />
              </FitnessRing>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.cardHeading, { color: c.ink }]}>
                  Stay refreshed
                </Text>
                <Text style={[styles.metric, { color: c.ink }]}>
                  {water === null ? '—' : numberLabel(water / 1000)}
                  <Text style={[styles.small, { color: c.muted }]}>
                    {' '}
                    {water === null ? 'No water entry yet' : 'litres logged'}
                  </Text>
                </Text>
                {target && (
                  <Text style={[styles.small, { color: c.muted }]}>
                    Reference · {fitnessRangeLabel(target, ' ml')}
                  </Text>
                )}
              </View>
            </View>
            <FitnessAction
              label={waterError ? 'Retry glass' : 'Add glass · 250 ml'}
              icon="plus"
              secondary
              compact
              busy={mutation.isPending}
              onPress={() => void addGlass()}
            />
            <FitnessNotice error message={waterError} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose water amount"
              onPress={() =>
                route('FitnessLog', { kind: 'water', date: data.date })
              }
              style={{
                minHeight: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}
              >
                Choose an amount
              </Text>
            </Pressable>
          </FitnessCard>
          <FitnessExpertHome />
          <FitnessSection title="Make it yours" />
          <View style={styles.featureRow}>
            <QuickAction
              label="Weight"
              Icon={Scale}
              onPress={() => route('FitnessLog', { kind: 'weight' })}
            />
            <QuickAction
              label="Sleep"
              Icon={Moon}
              onPress={() => route('FitnessLog', { kind: 'sleep' })}
            />
            <QuickAction
              label="Habits"
              Icon={Plus}
              onPress={() => route('FitnessLog', { kind: 'habit' })}
            />
          </View>
          <View
            style={[
              styles.navigation,
              { backgroundColor: c.surface, borderColor: c.line },
            ]}
          >
            {[
              {
                label: 'Progress',
                caption: 'Your journey, in perspective',
                Icon: TrendingUp,
                screen: 'FitnessProgress',
              },
              {
                label: 'Browse experts',
                caption: 'Trainers & nutritionists',
                Icon: UsersRound,
                screen: 'FitnessExperts',
              },
              {
                label: 'My plan',
                caption: 'Your saved weekly routine',
                Icon: Dumbbell,
                screen: 'FitnessPlan',
              },
              {
                label: 'History',
                caption: 'Your private journal',
                Icon: History,
                screen: 'FitnessHistory',
              },
            ].map(({ label, caption, Icon, screen }, index) => (
              <Pressable
                key={screen}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => route(screen)}
                style={[
                  styles.navRow,
                  {
                    borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: c.line,
                  },
                ]}
              >
                <View style={[styles.navIcon, { backgroundColor: c.soft }]}>
                  <Icon size={21} strokeWidth={1.7} color={c.accent} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.label, { color: c.ink }]}>{label}</Text>
                  <Text style={[styles.small, { color: c.muted }]}>
                    {caption}
                  </Text>
                </View>
                <ChevronRight size={19} color={c.muted} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </FitnessScreen>
  );
}
export function TodayNutrition({
  day,
  targets,
  reviewRequired,
  onAdd,
}: {
  day: FitnessSummary['today'];
  targets?: FitnessTargets | null;
  reviewRequired: boolean;
  onAdd: () => void;
}) {
  const c = useFitnessColors();
  const calories = dayMetric(day, 'calories');
  const range = targets?.calories;
  const percent = rangeProgress(calories, range);
  return (
    <FitnessCard>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 15,
          flexWrap: 'wrap',
        }}
      >
        <FitnessRing
          size={112}
          strokeWidth={8}
          value={percent}
          color={c.clay}
          label={
            calories === null
              ? 'No meal entry yet'
              : `${numberLabel(calories)} kcal logged${
                  range
                    ? ` of ${fitnessRangeLabel(range, ' kcal')} daily reference`
                    : ''
                }`
          }
        >
          <Text style={[styles.calories, { color: c.ink }]}>
            {numberLabel(calories)}
          </Text>
          <Text style={[styles.small, { color: c.muted }]}>
            {calories === null ? 'No meals yet' : 'kcal logged'}
          </Text>
        </FitnessRing>
        <View style={{ flex: 1, minWidth: 120, gap: 7 }}>
          <Text style={[styles.cardHeading, { color: c.ink }]}>
            Nourish your day
          </Text>
          <Text style={[styles.small, { color: c.muted }]}>
            {range
              ? `Daily reference · ${fitnessRangeLabel(range, ' kcal')}`
              : reviewRequired
              ? 'Targets withheld for professional review'
              : 'Log meals to build your journal.'}
          </Text>
          {(['proteinG', 'carbsG', 'fatG'] as const).map((key, index) => {
            const amount = dayMetric(day, key);
            const target = targets?.[key];
            const progress = rangeProgress(amount, target);
            const width = `${progress ?? 0}%` as `${number}%`;
            return (
              <View key={key} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <Text style={[styles.small, { color: c.muted }]}>
                    {['Protein', 'Carbs', 'Fat'][index]}
                  </Text>
                  <Text style={[styles.small, { color: c.ink }]}>
                    {numberLabel(amount)} g
                  </Text>
                </View>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: c.line,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 4,
                      width,
                      backgroundColor: index === 1 ? c.clay : c.accent,
                      opacity: index === 2 ? 0.65 : 1,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <FitnessAction
        label="Add meal"
        icon="plus"
        secondary
        compact
        onPress={onAdd}
      />
    </FitnessCard>
  );
}
function QuickAction({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
}) {
  const c = useFitnessColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${label.toLowerCase()}`}
      onPress={onPress}
      style={[styles.feature, { backgroundColor: c.soft, minHeight: 80 }]}
    >
      <Icon color={c.accent} size={23} strokeWidth={1.6} />
      <Text style={[styles.small, { color: c.ink, fontWeight: '600' }]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  date: { fontSize: 12, lineHeight: 18 },
  greetingTitle: { fontSize: 30, fontWeight: '600', letterSpacing: -1 },
  featureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  feature: {
    flexGrow: 1,
    flexBasis: '28%',
    minWidth: 74,
    minHeight: 76,
    borderRadius: 20,
    padding: 12,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEyebrow: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#fff',
  },
  photoTitle: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: '#fff',
    lineHeight: 34,
  },
  photoCaption: { fontSize: 13, lineHeight: 19, color: '#fff', flexShrink: 1 },
  photoTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  review: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20 },
  small: { fontSize: 12, lineHeight: 18 },
  cardHeading: { fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  metric: { fontSize: 24, fontWeight: '500', letterSpacing: -0.5 },
  calories: { fontSize: 25, fontWeight: '600', letterSpacing: -0.8 },
  navigation: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 16 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    minHeight: 74,
  },
  navIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});

function rangeProgress(
  actual: number | null,
  range?: { min: number; max: number } | null,
): number | null {
  const denominator =
    range && (range.min > 0 ? range.min : range.max > 0 ? range.max : null);
  return actual === null || !denominator
    ? null
    : Math.min(100, Math.max(0, (actual / denominator) * 100));
}
