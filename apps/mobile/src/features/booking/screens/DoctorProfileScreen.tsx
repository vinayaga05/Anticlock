import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { LocationBar } from '@/shared/components/LocationBar';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function DoctorProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'DoctorProfile'>>();
  const doctor = doctors.find(d => d.id === route.params.doctorId) ?? doctors[0];

  return (
    <ScreenContainer scrollable tabAware={false}>
      <LocationBar />

      <View style={styles.hero}>
        <Image source={{ uri: doctor.imageUrl }} style={styles.photo} />
        <Card style={{ flex: 1, gap: 6 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
            {doctor.registration}
          </Text>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {doctor.name}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {doctor.specialty}
          </Text>
          <View style={styles.expRow}>
            <AppIcon name="activity" size={14} color={theme.colors.primary} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {doctor.experienceYears} years · Rs {doctor.fee}
            </Text>
          </View>
        </Card>
      </View>

      <Card>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary, marginBottom: 10 }]}>
          Consultation available
        </Text>
        <View style={styles.modeRow}>
          {[
            { label: 'Online', icon: 'video' as const },
            { label: 'Clinic', icon: 'hospital' as const },
            { label: 'Home', icon: 'home-visit' as const },
          ].map(mode => (
            <View
              key={mode.label}
              style={[
                styles.mode,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.backgroundElevated,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <AppIcon name={mode.icon} size={14} color={theme.colors.primary} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {mode.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>About</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
          {doctor.about}
        </Text>
      </Card>

      <Card>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>Education</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
          {doctor.education.join(' · ')}
        </Text>
      </Card>

      <Card>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>Languages</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
          {doctor.languages.join(', ')}
        </Text>
        <View style={styles.bookRow}>
          <Button title={`Rs ${doctor.fee}`} variant="secondary" style={{ flex: 1 }} />
          <Button
            title="Book appointment"
            icon="calendar"
            style={{ flex: 1.4 }}
            onPress={() =>
              navigation.navigate('Schedule', {
                kind: 'doctor',
                id: doctor.id,
                title: doctor.name,
                fee: doctor.fee,
              })
            }
          />
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  photo: { width: 110, height: 120, borderRadius: 18 },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bookRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
