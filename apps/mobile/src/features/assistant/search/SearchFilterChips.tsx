import React from 'react';
import { Text, View } from 'react-native';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import type { SearchFilters } from './searchState';

export function SearchFilterChips({
  filters,
  onClear,
}: {
  filters: SearchFilters;
  onClear: (key: keyof SearchFilters) => void;
}) {
  const { colors, radius } = useTheme();
  const entries: [keyof SearchFilters, string | undefined][] = [
    ['areaLabel', filters.areaLabel],
    ['nearby', filters.nearby ? 'Within 25 km' : undefined],
    [
      'maxPrice',
      filters.maxPrice != null ? `Up to ₹${filters.maxPrice}` : undefined,
    ],
    [
      'minRating',
      filters.minRating != null ? `${filters.minRating}+ stars` : undefined,
    ],
    ['verified', filters.verified ? 'Verified' : undefined],
    [
      'availability',
      filters.availability === 'today'
        ? 'Available today'
        : filters.availability
        ? 'Open now'
        : undefined,
    ],
    ['joining', filters.joining ? 'Accepting members' : undefined],
    ['upcoming', filters.upcoming ? 'Upcoming' : undefined],
    ['sort', filters.sort === 'recent' ? 'Most recent' : undefined],
  ];
  if (!entries.some(([, label]) => label)) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {entries.flatMap(([key, label]) =>
        label
          ? [
              <PressableScale
                key={key}
                onPress={() => onClear(key)}
                accessibilityLabel={`Clear ${label} filter`}
                style={{
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {label} ×
                </Text>
              </PressableScale>,
            ]
          : [],
      )}
    </View>
  );
}
