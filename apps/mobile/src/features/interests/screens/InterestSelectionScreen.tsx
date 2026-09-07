import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  useMyInterestsQuery,
  useUpdateMyInterestsMutation,
} from '@/features/interests/hooks/useInterestPreferences';

type Props = {
  mode: 'onboarding' | 'settings';
};

export function InterestSelectionScreen({ mode }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { data, isLoading, error } = useMyInterestsQuery();
  const updateInterests = useUpdateMyInterestsMutation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedKey = data?.selectedInterestIds.join('|') ?? '';
  useEffect(() => {
    setSelectedIds(data?.selectedInterestIds ?? []);
  }, [selectedKey]);

  const minSelections = data?.minSelections ?? 3;
  const canContinue = selectedIds.length >= minSelections;
  const subtitle = useMemo(
    () =>
      selectedIds.length >= minSelections
        ? `${selectedIds.length} interests selected`
        : `Choose at least ${minSelections} interests to continue`,
    [minSelections, selectedIds.length],
  );

  const toggleInterest = (id: string) => {
    setSelectedIds(current =>
      current.includes(id)
        ? current.filter(selectedId => selectedId !== id)
        : [...current, id],
    );
  };

  const save = async () => {
    if (!canContinue) return;
    try {
      await updateInterests.mutateAsync(selectedIds);
      if (mode === 'settings') navigation.goBack();
    } catch {
      // The API message below gives the user the next action without leaving the screen.
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const errorMessage = updateInterests.error instanceof Error
    ? updateInterests.error.message
    : error instanceof Error
      ? error.message
      : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        {mode === 'settings' ? (
          <PressableScale
            accessibilityLabel="Back to settings"
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.colors.surfaceMuted }]}>
            <AppIcon name="back" size={20} color={theme.colors.textPrimary} />
          </PressableScale>
        ) : null}
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {mode === 'settings' ? 'Your interests' : "Let's select your interests."}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>

        {data?.options.length ? (
          <View style={styles.grid}>
            {data.options.map(option => {
              const selected = selectedIds.includes(option.id);
              return (
                <PressableScale
                  key={option.id}
                  accessibilityLabel={`${option.name}${selected ? ', selected' : ''}`}
                  onPress={() => toggleInterest(option.id)}
                  style={styles.tilePressable}>
                  <ImageBackground
                    source={option.imageUrl ? { uri: option.imageUrl } : undefined}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    imageStyle={styles.tileImage}>
                    <View style={styles.tileShade} />
                    {selected ? (
                      <View style={[styles.check, { backgroundColor: theme.colors.primary }]}>
                        <AppIcon name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                    <Text style={styles.tileLabel} numberOfLines={2}>
                      {option.name}
                    </Text>
                  </ImageBackground>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <View style={[styles.empty, { backgroundColor: theme.colors.surfaceMuted }]}>
            <Text style={{ color: theme.colors.textSecondary }}>
              Interests are not available yet. Please try again shortly.
            </Text>
          </View>
        )}

        {errorMessage ? (
          <Text style={[styles.error, { color: theme.colors.error }]}>{errorMessage}</Text>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderSoft,
            paddingBottom: insets.bottom + 16,
          },
        ]}>
        <Button
          title={mode === 'settings' ? 'Save interests' : 'Continue'}
          onPress={() => void save()}
          disabled={!canContinue || !data?.options.length}
          loading={updateInterests.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20 },
  backButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginBottom: 24,
    width: 40,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
  },
  tilePressable: { width: '30.8%' },
  tile: {
    aspectRatio: 0.88,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 8,
  },
  tileImage: { borderRadius: 12 },
  tileShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  check: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 22,
  },
  tileLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  empty: { borderRadius: 16, marginTop: 28, padding: 18 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
});
