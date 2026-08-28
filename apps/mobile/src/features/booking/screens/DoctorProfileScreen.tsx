import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { Glass } from '@/shared/components/Glass';
import { Button } from '@/shared/components/Button';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors, timeSlots } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { healthTheme } from '@/shared/theme/healthTheme';
import { getUpcomingBookingDates } from '@/shared/utils/bookingDates';
import { ServiceMode } from '@/shared/types';

const MODE_ICONS: Record<ServiceMode, IconName> = {
  online: 'video',
  center: 'location',
  home: 'home',
};

export function DoctorProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'DoctorProfile'>>();
  const doctor = doctors.find(d => d.id === route.params.doctorId) ?? doctors[0];
  const dates = useMemo(() => getUpcomingBookingDates(6), []);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.id ?? '');
  const [selectedTime, setSelectedTime] = useState(timeSlots[0] ?? null);
  const modeIcons = doctor.modes.slice(0, 3);

  const stats = [
    { label: `${doctor.experienceYears} Years`, sub: 'Experience', icon: 'activity' as const },
    {
      label: doctor.patientsServed ?? '—',
      sub: 'Patients',
      icon: 'users' as const,
    },
    { label: String(doctor.rating), sub: 'Reviews', icon: 'star' as const },
  ];

  return (
    <HealthScreenShell scrollable={false} padded={false} tabAware={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Image source={{ uri: doctor.imageUrl }} style={styles.heroPhoto} />
          <Glass variant="health" intensity="heavy" radius={healthTheme.radius} elevated style={styles.profileGlass}>
            <View style={styles.ratingBadge}>
              <AppIcon name="star" size={12} color="#FBBF24" fill="#FBBF24" />
              <Text style={styles.ratingText}>{doctor.rating}</Text>
            </View>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorQual}>
              {doctor.qualification} · {doctor.specialty}
            </Text>
            <View style={styles.actionRow}>
              <Glass variant="health" intensity="medium" radius={999} style={styles.detailsPill}>
                <AppIcon name="doctor" size={14} color={healthTheme.navy} />
                <Text style={styles.detailsText}>Details</Text>
              </Glass>
              {modeIcons.map(mode => (
                <PressableScale key={mode} style={styles.roundBtn}>
                  <AppIcon name={MODE_ICONS[mode]} size={18} color={healthTheme.navy} />
                </PressableScale>
              ))}
              <PressableScale style={styles.roundBtn}>
                <AppIcon name="messages" size={18} color={healthTheme.navy} />
              </PressableScale>
            </View>
          </Glass>
        </View>

        <Glass variant="health" intensity="medium" radius={healthTheme.radiusMd} elevated style={styles.statsBar}>
          {stats.map(stat => (
            <View key={stat.sub} style={styles.statCol}>
              <AppIcon name={stat.icon} size={16} color={healthTheme.navy} />
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statSub}>{stat.sub}</Text>
            </View>
          ))}
        </Glass>

        <View style={styles.bookingSheet}>
          <Text style={[theme.typography.section, { color: healthTheme.text }]}>Select date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {dates.map(d => {
              const active = selectedDate === d.id;
              return (
                <PressableScale
                  key={d.id}
                  onPress={() => setSelectedDate(d.id)}
                  style={active ? [styles.dateCard, styles.dateCardActive] : styles.dateCard}>
                  <Text style={active ? [styles.dateNum, styles.dateNumActive] : styles.dateNum}>{d.label}</Text>
                  <Text style={active ? [styles.dateDay, styles.dateDayActive] : styles.dateDay}>{d.day}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <Text style={[theme.typography.section, { color: healthTheme.text, marginTop: 8 }]}>
            Available time
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeRow}>
            {timeSlots.map(slot => {
              const active = selectedTime === slot;
              return (
                <PressableScale
                  key={slot}
                  onPress={() => setSelectedTime(slot)}
                  style={active ? [styles.timeChip, styles.timeChipActive] : styles.timeChip}>
                  <Text style={active ? [styles.timeText, styles.timeTextActive] : styles.timeText}>
                    {slot}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
          {doctor.nextSlot ? (
            <Text style={[theme.typography.caption, { color: healthTheme.textMuted, textAlign: 'center' }]}>
              Next available: {doctor.nextSlot}
            </Text>
          ) : null}

          <Glass variant="health" intensity="light" radius={healthTheme.radiusMd} style={styles.aboutCard}>
            <Text style={[theme.typography.bodySmall, { color: healthTheme.textMuted, lineHeight: 20 }]}>
              {doctor.about}
            </Text>
          </Glass>

          <Button
            title="Book Session"
            variant="health"
            icon="calendar"
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
      </ScrollView>
    </HealthScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 32 },
  hero: {
    backgroundColor: healthTheme.skyMuted,
    paddingBottom: 24,
  },
  heroPhoto: {
    width: '100%',
    height: 280,
    backgroundColor: healthTheme.skySoft,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  profileGlass: {
    marginHorizontal: 16,
    marginTop: -56,
    padding: 16,
    gap: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: healthTheme.navySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingText: { fontSize: 12, fontWeight: '800', color: healthTheme.navy },
  doctorName: { fontSize: 22, fontWeight: '800', color: healthTheme.text },
  doctorQual: { fontSize: 13, color: healthTheme.textMuted, fontWeight: '500' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 4,
  },
  detailsText: { fontSize: 12, fontWeight: '700', color: healthTheme.navy },
  statsBar: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 13, fontWeight: '800', color: healthTheme.text },
  statSub: { fontSize: 11, color: healthTheme.textMuted },
  bookingSheet: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: healthTheme.white,
    borderRadius: healthTheme.radius,
    padding: 18,
    gap: 12,
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  dateRow: { gap: 10, paddingVertical: 4 },
  dateCard: {
    width: 56,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: healthTheme.backgroundSoft,
  },
  dateCardActive: { backgroundColor: healthTheme.skySoft },
  dateNum: { fontSize: 18, fontWeight: '800', color: healthTheme.textMuted },
  dateNumActive: { color: healthTheme.navy },
  dateDay: { fontSize: 11, color: healthTheme.textMuted, marginTop: 2 },
  dateDayActive: { color: healthTheme.navy, fontWeight: '700' },
  timeRow: { gap: 10, paddingVertical: 4 },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: healthTheme.backgroundSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: healthTheme.glass.light.border,
  },
  timeChipActive: {
    backgroundColor: healthTheme.skySoft,
    borderColor: healthTheme.sky,
  },
  timeText: { fontSize: 13, fontWeight: '600', color: healthTheme.textMuted },
  timeTextActive: { color: healthTheme.navy, fontWeight: '700' },
  aboutCard: { padding: 14 },
});
