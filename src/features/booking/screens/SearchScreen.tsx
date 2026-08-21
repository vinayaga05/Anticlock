import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors, fitnessClasses, labs, shopProducts } from '@/shared/data/mocks';

export function SearchScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) {
      return [
        ...doctors.map(d => ({
          id: d.id,
          title: d.name,
          subtitle: d.specialty,
          onPress: () => navigation.navigate('DoctorProfile', { doctorId: d.id }),
        })),
        ...labs.map(l => ({
          id: l.id,
          title: l.name,
          subtitle: l.location,
          onPress: () => navigation.navigate('LabDetail', { labId: l.id }),
        })),
        ...fitnessClasses.map(c => ({
          id: c.id,
          title: c.title,
          subtitle: c.coach,
          onPress: () => navigation.navigate('ClassDetail', { classId: c.id }),
        })),
      ];
    }
    return [
      ...doctors
        .filter(d => `${d.name} ${d.specialty}`.toLowerCase().includes(query))
        .map(d => ({
          id: d.id,
          title: d.name,
          subtitle: d.specialty,
          onPress: () => navigation.navigate('DoctorProfile', { doctorId: d.id }),
        })),
      ...labs
        .filter(l => l.name.toLowerCase().includes(query))
        .map(l => ({
          id: l.id,
          title: l.name,
          subtitle: l.location,
          onPress: () => navigation.navigate('LabDetail', { labId: l.id }),
        })),
      ...fitnessClasses
        .filter(c => `${c.title} ${c.coach}`.toLowerCase().includes(query))
        .map(c => ({
          id: c.id,
          title: c.title,
          subtitle: c.coach,
          onPress: () => navigation.navigate('ClassDetail', { classId: c.id }),
        })),
      ...shopProducts
        .filter(p => p.name.toLowerCase().includes(query))
        .map(p => ({
          id: p.id,
          title: p.name,
          subtitle: `Rs ${p.price}`,
          onPress: () => navigation.navigate('Main', { screen: 'Shop' }),
        })),
    ];
  }, [navigation, q]);

  return (
    <ScreenContainer scrollable>
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Search</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Doctors, labs, classes, products"
        placeholderTextColor={theme.colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.navy,
          },
        ]}
        autoFocus
      />
      {results.map(item => (
        <Pressable
          key={`${item.id}-${item.title}`}
          onPress={item.onPress}
          style={[styles.row, { backgroundColor: theme.colors.surface }]}>
          <View>
            <Text style={{ color: theme.colors.navy, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: '#666' }}>{item.subtitle}</Text>
          </View>
        </Pressable>
      ))}
      {results.length === 0 ? (
        <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          No matches found.
        </Text>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700' },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  row: {
    borderRadius: 12,
    padding: 14,
  },
});
