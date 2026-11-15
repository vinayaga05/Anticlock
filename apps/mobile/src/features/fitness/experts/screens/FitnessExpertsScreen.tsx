import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { FitnessExpert } from '@anticlock/contracts';
import { navigateToProvider } from '@/shared/navigation/businessNavigation';
import { useFitnessQuery } from '../../api/fitnessApi';
import { localFitnessDate } from '../../fitnessModel';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessSheet,
  FitnessStepper,
  FitnessToggle,
} from '../../components/FitnessControls';
import { FitnessAvatar } from '../../components/FitnessVisuals';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessField,
  FitnessNotice,
  FitnessLoading,
  FitnessScreen,
  FitnessSection,
  FitnessText,
  useFitnessColors,
} from '../../components/FitnessUI';

type Filters = {
  kind: string;
  mode: string;
  language: string;
  location: string;
  speciality: string;
  price?: number;
  rating: string;
  date?: string;
  available: string;
};
const emptyFilters: Filters = {
  kind: 'all',
  mode: 'all',
  language: 'Any',
  location: 'Any',
  speciality: 'Any',
  rating: 'any',
  available: 'any',
};
function queryFor(filters: Filters) {
  const values: Record<string, string> = {};
  if (filters.kind !== 'all') values.kind = filters.kind;
  if (filters.mode !== 'all') values.mode = filters.mode;
  for (const key of ['language', 'location', 'speciality'] as const)
    if (filters[key] !== 'Any' && filters[key].trim())
      values[key] = filters[key].trim();
  if (filters.price !== undefined) values.maxPrice = String(filters.price);
  if (filters.rating !== 'any') values.minRating = filters.rating;
  if (filters.available !== 'any')
    values.available = filters.available === 'available' ? 'true' : 'false';
  if (filters.date) values.date = filters.date;
  const query = Object.entries(values)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `?${query}` : '';
}
export function FitnessExpertsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const colors = useFitnessColors();
  const [applied, setApplied] = useState<Filters>(() => ({
    ...emptyFilters,
    kind: route.params?.kind ?? 'all',
  }));
  const [draft, setDraft] = useState(applied);
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<FitnessExpert[]>([]);
  const filterQuery = queryFor(applied);
  const result = useFitnessQuery<{
    experts: FitnessExpert[];
    nextOffset: number | null;
  }>(
    `/experts${filterQuery}${
      offset ? `${filterQuery ? '&' : '?'}offset=${offset}` : ''
    }`,
  );
  const experts =
    offset === 0
      ? result.data?.experts ?? []
      : [
          ...new Map(
            [...loaded, ...(result.data?.experts ?? [])].map(expert => [
              expert.id,
              expert,
            ]),
          ).values(),
        ];
  React.useEffect(() => {
    if (result.data)
      setLoaded(previous =>
        offset === 0
          ? result.data!.experts
          : [
              ...new Map(
                [...previous, ...result.data!.experts].map(expert => [
                  expert.id,
                  expert,
                ]),
              ).values(),
            ],
      );
  }, [result.data, offset]);
  const [known, setKnown] = useState<FitnessExpert[]>([]);
  React.useEffect(() => {
    if (result.data)
      setKnown(previous => [
        ...new Map(
          [...previous, ...result.data.experts].map(expert => [
            expert.id,
            expert,
          ]),
        ).values(),
      ]);
  }, [result.data]);
  const options = (
    key: 'specialities' | 'languages' | 'city',
    selected: string,
  ) => [
    ...new Set([
      'Any',
      ...(selected === 'Any' ? [] : [selected]),
      ...known.flatMap(expert =>
        key === 'city' ? (expert.city ? [expert.city] : []) : expert[key],
      ),
    ]),
  ];
  const change = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const count = Object.keys(applied).filter(
    key =>
      applied[key as keyof Filters] !== emptyFilters[key as keyof Filters] &&
      applied[key as keyof Filters] !== undefined,
  ).length;
  const link = (
    label: string,
    accessibilityLabel: string,
    onPress: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
    >
      <FitnessText>{label}</FitnessText>
    </Pressable>
  );
  return (
    <FitnessScreen
      title="Find your expert"
      subtitle="Approved trainers and nutritionists, matched to you."
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <FitnessText muted>
          {result.isLoading
            ? 'Finding experts…'
            : `${experts.length} ${
                experts.length === 1 ? 'expert' : 'experts'
              }`}
        </FitnessText>
        <FitnessAction
          secondary
          icon="settings"
          label={count ? `Filters · ${count}` : 'Filters'}
          onPress={() => {
            setDraft({ ...applied });
            setShowFilters(true);
          }}
        />
      </View>
      {result.isLoading && !experts.length ? (
        <FitnessLoading />
      ) : result.error && !experts.length ? (
        <FitnessEmpty
          title="Experts could not be loaded"
          message={result.error.message}
          action="Try again"
          onPress={() => void result.refetch()}
        />
      ) : !experts.length ? (
        <FitnessEmpty
          title="No matching experts yet"
          message="Try another filter. Only approved professionals with recorded qualifications appear here."
          action="Adjust filters"
          onPress={() => {
            setDraft({ ...applied });
            setShowFilters(true);
          }}
        />
      ) : (
        experts.map(expert => (
          <FitnessCard key={expert.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View profile, services & Clips"
              onPress={() =>
                navigateToProvider(nav, expert.id, expert.categoryId)
              }
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                minHeight: 64,
              }}
            >
              <FitnessAvatar
                uri={expert.avatarUrl ?? undefined}
                name={expert.name}
                size={64}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <FitnessSection title={expert.name} />
                <FitnessText muted>
                  {expert.kind === 'trainer'
                    ? 'Fitness trainer'
                    : 'Nutritionist'}
                </FitnessText>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: colors.soft,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 20,
                  }}
                >
                  <FitnessText>Approved provider</FitnessText>
                </View>
              </View>
            </Pressable>
            {!!expert.specialities.length && (
              <FitnessText>
                {expert.specialities.slice(0, 2).join(' · ')}
              </FitnessText>
            )}
            <FitnessText muted>
              {expert.rating === null
                ? 'No reviews yet'
                : `${expert.rating.toFixed(1)} · ${expert.reviewCount} reviews`}
              {expert.priceFrom === null
                ? ' · Price on profile'
                : ` · From ₹${expert.priceFrom}`}
            </FitnessText>
            <FitnessText muted>
              {[
                ...expert.modes.map(
                  mode =>
                    ({ online: 'Online', home: 'At home', center: 'At centre' }[
                      mode
                    ] ?? mode),
                ),
                expert.city,
              ]
                .filter(Boolean)
                .join(' · ')}
            </FitnessText>
            <FitnessText muted>
              {expert.available
                ? expert.nextAvailableAt
                  ? `Next slot · ${new Date(
                      expert.nextAvailableAt,
                    ).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`
                  : 'Accepting bookings'
                : 'Currently unavailable'}
            </FitnessText>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <FitnessAction
                secondary
                compact
                label="Book a consultation"
                disabled={!expert.available}
                onPress={() =>
                  nav.navigate('BusinessBooking', {
                    providerId: expert.id,
                    categoryId: expert.categoryId,
                  })
                }
              />
              {link('Sharing', 'Manage sharing', () =>
                nav.navigate('FitnessSharing', {
                  providerId: expert.id,
                  providerName: expert.name,
                }),
              )}
            </View>
          </FitnessCard>
        ))
      )}
      {offset > 0 && result.error && experts.length > 0 && (
        <>
          <FitnessNotice error message={result.error.message} />
          <FitnessAction
            secondary
            label="Retry next results"
            onPress={() => void result.refetch()}
          />
        </>
      )}
      {result.data?.nextOffset !== null &&
        result.data?.nextOffset !== undefined && (
          <FitnessAction
            secondary
            label="Next results"
            busy={result.isLoading}
            onPress={() => setOffset(result.data!.nextOffset!)}
          />
        )}
      {offset > 0 && result.isLoading && <FitnessLoading />}
      <FitnessSheet
        visible={showFilters}
        title="Find your fit"
        onClose={() => setShowFilters(false)}
      >
        <FitnessChoices
          label="Professional"
          options={['All experts', 'Trainers', 'Nutritionists']}
          selected={
            {
              all: 'All experts',
              trainer: 'Trainers',
              nutritionist: 'Nutritionists',
            }[draft.kind] ?? 'All experts'
          }
          onChange={value =>
            change(
              'kind',
              (
                {
                  'All experts': 'all',
                  Trainers: 'trainer',
                  Nutritionists: 'nutritionist',
                } as Record<string, string>
              )[value],
            )
          }
        />
        <FitnessChoices
          label="Consultation mode"
          options={['Any', 'Online', 'At home', 'At centre']}
          selected={
            {
              all: 'Any',
              online: 'Online',
              home: 'At home',
              center: 'At centre',
            }[draft.mode] ?? 'Any'
          }
          onChange={value =>
            change(
              'mode',
              (
                {
                  Any: 'all',
                  Online: 'online',
                  'At home': 'home',
                  'At centre': 'center',
                } as Record<string, string>
              )[value],
            )
          }
        />
        <FitnessChoices
          label="Speciality"
          options={options('specialities', draft.speciality)}
          selected={draft.speciality}
          onChange={value => change('speciality', value)}
        />
        <FitnessChoices
          label="Language"
          options={options('languages', draft.language)}
          selected={draft.language}
          onChange={value => change('language', value)}
        />
        <FitnessChoices
          label="City or area"
          options={options('city', draft.location)}
          selected={draft.location}
          onChange={value => change('location', value)}
        />
        <FitnessDisclosure
          title="Search another speciality or place"
          subtitle="For options beyond the results shown"
        >
          <FitnessField
            label="Other speciality"
            value={draft.speciality === 'Any' ? '' : draft.speciality}
            placeholder="Enter a speciality"
            onChangeText={value =>
              change('speciality', value.trim() ? value : 'Any')
            }
          />
          <FitnessField
            label="Other language"
            value={draft.language === 'Any' ? '' : draft.language}
            placeholder="Enter a language"
            onChangeText={value =>
              change('language', value.trim() ? value : 'Any')
            }
          />
          <FitnessField
            label="Other city or area"
            value={draft.location === 'Any' ? '' : draft.location}
            placeholder="Enter a city or area"
            onChangeText={value =>
              change('location', value.trim() ? value : 'Any')
            }
          />
        </FitnessDisclosure>
        <FitnessToggle
          label="Set a price limit"
          value={draft.price !== undefined}
          onChange={value => change('price', value ? 1000 : undefined)}
        />
        {draft.price !== undefined && (
          <FitnessStepper
            label="Maximum session price"
            value={draft.price}
            onChange={value => change('price', value)}
            min={0}
            max={100000}
            step={250}
            unit="₹"
          />
        )}
        <FitnessChoices
          label="Minimum rating"
          options={['Any', '3+', '4+', '4.5+']}
          selected={draft.rating === 'any' ? 'Any' : `${draft.rating}+`}
          onChange={value =>
            change('rating', value === 'Any' ? 'any' : value.replace('+', ''))
          }
        />
        <FitnessChoices
          label="Availability"
          options={['Any', 'Available', 'Unavailable']}
          selected={
            { any: 'Any', available: 'Available', unavailable: 'Unavailable' }[
              draft.available
            ] ?? 'Any'
          }
          onChange={value => change('available', value.toLowerCase())}
        />
        <FitnessToggle
          label="Choose a date"
          value={Boolean(draft.date)}
          onChange={value =>
            change('date', value ? localFitnessDate() : undefined)
          }
        />
        {draft.date && (
          <FitnessDatePicker
            label="Available date"
            value={draft.date}
            onChange={value => change('date', value)}
            minimumDate={new Date()}
          />
        )}
        <FitnessAction
          label="Apply filters"
          onPress={() => {
            setLoaded([]);
            setOffset(0);
            setApplied({ ...draft });
            setShowFilters(false);
          }}
        />
        <FitnessAction
          secondary
          label="Clear filters"
          onPress={() => setDraft({ ...emptyFilters })}
        />
        <FitnessAction
          secondary
          label="Cancel"
          onPress={() => setShowFilters(false)}
        />
      </FitnessSheet>
    </FitnessScreen>
  );
}
