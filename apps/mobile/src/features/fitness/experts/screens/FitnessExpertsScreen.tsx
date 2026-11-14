import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { FitnessExpert } from '@anticlock/contracts';
import { navigateToProvider } from '@/shared/navigation/businessNavigation';
import { useFitnessQuery } from '../../api/fitnessApi';
import {
  FitnessAction,
  FitnessCard,
  FitnessChoices,
  FitnessEmpty,
  FitnessField,
  FitnessLoading,
  FitnessNotice,
  FitnessScreen,
  FitnessSection,
  FitnessText,
} from '../../components/FitnessUI';

export function FitnessExpertsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [kind, setKind] = useState(route.params?.kind ?? 'all'),
    [mode, setMode] = useState('all'),
    [language, setLanguage] = useState(''),
    [location, setLocation] = useState(''),
    [speciality, setSpeciality] = useState(''),
    [price, setPrice] = useState(''),
    [rating, setRating] = useState('any'),
    [date, setDate] = useState(''),
    [available, setAvailable] = useState('any');
  const [query, setQuery] = useState(() =>
    route.params?.kind ? `?kind=${encodeURIComponent(route.params.kind)}` : '',
  );
  const result = useFitnessQuery<{
    experts: FitnessExpert[];
    nextOffset: number | null;
  }>(`/experts${query}`);
  const [validation, setValidation] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const apply = () => {
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      setValidation('Use a valid maximum price.');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setValidation('Use a date in YYYY-MM-DD format.');
      return;
    }
    setValidation(null);
    const values: Record<string, string> = {
      ...(kind !== 'all' ? { kind } : {}),
      ...(mode !== 'all' ? { mode } : {}),
      ...(language.trim() ? { language: language.trim() } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(speciality.trim() ? { speciality: speciality.trim() } : {}),
      ...(price ? { maxPrice: price } : {}),
      ...(rating !== 'any' ? { minRating: rating } : {}),
      ...(available !== 'any'
        ? { available: available === 'available' ? 'true' : 'false' }
        : {}),
      ...(date ? { date } : {}),
    };
    setQuery(
      '?' +
        Object.entries(values)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&'),
    );
  };
  return (
    <FitnessScreen
      title="Your kind of expert"
      subtitle="Trainers and nutritionists with an approved application and recorded professional qualifications."
    >
      <FitnessCard tone="soft">
        <FitnessChoices
          label="Professional"
          options={['all', 'trainer', 'nutritionist']}
          selected={kind}
          onChange={setKind}
        />
        <FitnessChoices
          label="Consultation mode"
          options={['all', 'online', 'home', 'center']}
          selected={mode}
          onChange={setMode}
        />
        <FitnessAction
          secondary
          label={showFilters ? 'Hide filters' : 'More filters'}
          onPress={() => setShowFilters(!showFilters)}
        />
        {showFilters && (
          <View style={{ gap: 14 }}>
            <FitnessField
              label="Speciality"
              value={speciality}
              onChangeText={setSpeciality}
              placeholder="Strength, sports nutrition…"
            />
            <FitnessField
              label="Language"
              value={language}
              onChangeText={setLanguage}
            />
            <FitnessField
              label="City or area"
              value={location}
              onChangeText={setLocation}
            />
            <FitnessField
              label="Maximum session price (₹)"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
            <FitnessChoices
              label="Minimum rating"
              options={['any', '3', '4', '4.5']}
              selected={rating}
              onChange={setRating}
            />
            <FitnessChoices
              label="Availability"
              options={['any', 'available', 'unavailable']}
              selected={available}
              onChange={setAvailable}
            />
            <FitnessField
              label="Available date (optional)"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              hint="Choose a date to check actual bookable slots."
            />
          </View>
        )}
        <FitnessNotice message={validation} error />
        <FitnessAction label="Apply filters" onPress={apply} />
      </FitnessCard>
      {result.isLoading ? (
        <FitnessLoading />
      ) : result.error ? (
        <FitnessEmpty
          title="Experts could not be loaded"
          message={result.error.message}
          action="Try again"
          onPress={() => void result.refetch()}
        />
      ) : !result.data?.experts.length ? (
        <FitnessEmpty
          title="No matching experts yet"
          message="Try a different filter. Only approved professionals with recorded qualifications appear here."
        />
      ) : (
        result.data.experts.map(expert => (
          <FitnessCard key={expert.id}>
            <View
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
            >
              {expert.avatarUrl && (
                <Image
                  source={{ uri: expert.avatarUrl }}
                  style={{ width: 54, height: 54, borderRadius: 27 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <FitnessSection title={expert.name} />
                <FitnessText muted>
                  {expert.kind === 'trainer'
                    ? 'Fitness trainer'
                    : 'Nutritionist'}{' '}
                  · Approved provider
                </FitnessText>
              </View>
            </View>
            <FitnessText>{expert.qualifications.join(' · ')}</FitnessText>
            <FitnessText muted>
              Qualification details from the approved application
              {expert.approvedAt
                ? ` · reviewed ${new Date(
                    expert.approvedAt,
                  ).toLocaleDateString()}`
                : ''}
            </FitnessText>
            <FitnessText>{expert.specialities.join(' · ')}</FitnessText>
            <FitnessText muted>
              {expert.languages.length
                ? expert.languages.join(' · ')
                : 'Languages not listed'}
              {expert.city ? ` · ${expert.city}` : ''}
            </FitnessText>
            <FitnessText>
              {expert.priceFrom === null
                ? 'Price on profile'
                : `From ₹${expert.priceFrom}`}{' '}
              ·{' '}
              {expert.rating === null
                ? 'No reviews yet'
                : `${expert.rating.toFixed(1)} (${expert.reviewCount} reviews)`}
            </FitnessText>
            <FitnessText muted>
              {expert.available
                ? 'Accepting bookings'
                : 'Currently unavailable'}
              {expert.nextAvailableAt
                ? ` · next ${new Date(expert.nextAvailableAt).toLocaleString()}`
                : ''}
            </FitnessText>
            <FitnessAction
              label="View profile, services & Clips"
              onPress={() =>
                navigateToProvider(nav, expert.id, expert.categoryId)
              }
            />
            <FitnessAction
              secondary
              label="Book a consultation"
              disabled={!expert.available}
              onPress={() =>
                nav.navigate('BusinessBooking', {
                  providerId: expert.id,
                  categoryId: expert.categoryId,
                })
              }
            />
            <FitnessAction
              secondary
              label="Manage sharing"
              onPress={() =>
                nav.navigate('FitnessSharing', {
                  providerId: expert.id,
                  providerName: expert.name,
                })
              }
            />
          </FitnessCard>
        ))
      )}
      {result.data?.nextOffset !== null &&
        result.data?.nextOffset !== undefined && (
          <FitnessAction
            secondary
            label="Next experts"
            onPress={() => {
              const current = query
                .replace(/([?&])offset=\d+&?/g, '$1')
                .replace(/[?&]$/, '');
              setQuery(
                `${current}${current ? '&' : '?'}offset=${
                  result.data!.nextOffset
                }`,
              );
            }}
          />
        )}
    </FitnessScreen>
  );
}
