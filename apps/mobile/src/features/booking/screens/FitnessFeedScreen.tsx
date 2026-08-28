import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessClasses } from '@/shared/data/mocks';

export function FitnessFeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search classes" />
      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Discover classes
      </Text>
      <View style={styles.list}>
        {fitnessClasses.map(item => (
          <PressableScale
            key={item.id}
            onPress={() => navigation.navigate('ClassDetail', { classId: item.id })}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderSoft,
              },
            ]}>
            <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            <View style={styles.meta}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
                Coach: {item.coach}
              </Text>
              <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>
                {item.schedule} · Rs {item.fee}
              </Text>
            </View>
            <View style={[styles.cta, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.ctaText}>Book Now</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 88,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12 },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});
