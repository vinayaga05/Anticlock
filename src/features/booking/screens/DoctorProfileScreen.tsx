import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { LocationBar } from '@/shared/components/LocationBar';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function DoctorProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'DoctorProfile'>>();
  const doctor = doctors.find(d => d.id === route.params.doctorId) ?? doctors[0];

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <LocationBar />
      <View style={styles.hero}>
        <Image source={{ uri: doctor.imageUrl }} style={styles.photo} />
        <View style={[styles.info, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.reg}>{doctor.registration}</Text>
          <Text style={styles.name}>{doctor.name}</Text>
          <Text style={styles.spec}>{doctor.specialty}</Text>
        </View>
        <View style={[styles.exp, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.expText}>{doctor.experienceYears} years exp</Text>
          <Text style={styles.expText}>Rs.{doctor.fee}</Text>
        </View>
      </View>

      <View style={[styles.modes, { borderColor: theme.colors.primary }]}>
        <Text style={[styles.modesTitle, { color: theme.colors.textPrimary }]}>
          Consultation Available
        </Text>
        <View style={styles.modeRow}>
          <Text style={[styles.mode, { borderColor: '#E74C3C' }]}>Online</Text>
          <Text style={[styles.mode, { borderColor: '#27AE60' }]}>Clinic</Text>
          <Text style={[styles.mode, { borderColor: '#3498DB' }]}>Home Visit</Text>
        </View>
      </View>

      <Card title="About Dr" body={doctor.about} />
      <Card title="My Education" body={doctor.education.join(' · ')} />
      <View style={[styles.card, { backgroundColor: '#fff' }]}>
        <Text style={styles.cardTitle}>I Can Speak</Text>
        <Text style={{ color: '#333' }}>{doctor.languages.join(', ')}</Text>
        <View style={styles.bookRow}>
          <Button title={`Rs-${doctor.fee}`} variant="muted" style={{ flex: 1 }} />
          <Button
            title="Book Now"
            style={{ flex: 1 }}
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
      </View>
      <Card
        title="Testimonial"
        body="Very experienced and approachable. Explains everything clearly and makes patients comfortable."
      />
    </ScreenContainer>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={{ color: '#333', lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  photo: { width: 100, height: 110, borderRadius: 10 },
  info: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },
  reg: { color: '#fff', fontSize: 12 },
  name: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 4 },
  spec: { color: '#e8f7fa', marginTop: 2 },
  exp: {
    width: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  expText: { color: '#fff', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  modes: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  modesTitle: { fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 8 },
  mode: {
    color: '#fff',
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    color: '#111',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  bookRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
