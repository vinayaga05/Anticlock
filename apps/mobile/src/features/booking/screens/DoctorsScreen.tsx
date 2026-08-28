import React, { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { Glass } from '@/shared/components/Glass';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { Button } from '@/shared/components/Button';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors, labTests } from '@/shared/data/mocks';
import { healthTheme } from '@/shared/theme/healthTheme';
import { ServiceMode } from '@/shared/types';

const MODE_ICONS: Record<ServiceMode, IconName> = {
  online: 'video',
  center: 'location',
  home: 'home',
};

export function DoctorsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const healthServices = useMemo(() => {
    const general = doctors.find(d => d.specialty.toLowerCase().includes('general'));
    const specialist = doctors.find(d => !d.specialty.toLowerCase().includes('general'));
    const physio = doctors.find(d => d.specialty.toLowerCase().includes('physio'));
    const testFrom = Math.min(...labTests.map(t => t.priceFrom));

    return [
      {
        id: 'general',
        label: 'General Visits',
        price: `Rs ${general?.fee ?? doctors[0].fee}`,
        featured: false,
        onPress: () =>
          navigation.navigate('DoctorProfile', {
            doctorId: general?.id ?? doctors[0].id,
          }),
      },
      {
        id: 'specialist',
        label: 'Specialist Visits',
        price: `Rs ${specialist?.fee ?? doctors[0].fee}`,
        featured: false,
        onPress: () =>
          navigation.navigate('DoctorProfile', {
            doctorId: specialist?.id ?? doctors[0].id,
          }),
      },
      {
        id: 'tests',
        label: 'Medical Tests',
        price: `From Rs ${testFrom}`,
        featured: false,
        onPress: () => navigation.navigate('LabList', {}),
      },
      {
        id: 'therapeutic',
        label: 'Therapeutic',
        price: `Rs ${physio?.fee ?? doctors[0].fee}`,
        featured: true,
        onPress: () => navigation.navigate('PhysioHub'),
      },
    ];
  }, [navigation]);

  return (
    <HealthScreenShell scrollable tabAware={false}>
      <View style={styles.headerRow}>
        <BrandLogo height={34} />
        <View style={styles.headerActions}>
          <PressableScale onPress={() => navigation.navigate('Search')}>
            <Glass variant="health" intensity="medium" radius={22} style={styles.iconBtn}>
              <AppIcon name="search" size={18} color={healthTheme.navy} />
            </Glass>
          </PressableScale>
          <PressableScale onPress={() => navigation.navigate('Inbox')}>
            <Glass variant="health" intensity="medium" radius={22} style={styles.iconBtn}>
              <AppIcon name="bell" size={18} color={healthTheme.navy} />
            </Glass>
          </PressableScale>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredRow}>
        {doctors.map(doc => (
          <PressableScale
            key={doc.id}
            onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}
            style={styles.featuredCard}>
            <Image source={{ uri: doc.imageUrl }} style={styles.featuredPhoto} />
            <Glass variant="health" intensity="heavy" radius={healthTheme.radiusMd} style={styles.featuredGlass}>
              <Text style={styles.featuredName}>{doc.name}</Text>
              <Text style={styles.featuredSpec}>{doc.specialty}</Text>
              <View style={styles.featuredFooter}>
                <View style={styles.featuredIcons}>
                  {doc.modes.slice(0, 3).map(mode => (
                    <AppIcon key={mode} name={MODE_ICONS[mode]} size={14} color={healthTheme.navy} />
                  ))}
                </View>
                <View style={styles.featuredGo}>
                  <AppIcon name="chevron-right" size={16} color="#fff" />
                </View>
              </View>
            </Glass>
          </PressableScale>
        ))}
      </ScrollView>

      <Glass variant="health" intensity="heavy" radius={healthTheme.radius} elevated style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={[theme.typography.section, { color: healthTheme.text }]}>
            Let&apos;s find your doctor
          </Text>
          <View style={styles.sheetActions}>
            <PressableScale onPress={() => navigation.navigate('Search')}>
              <Glass variant="health" intensity="medium" radius={20} style={styles.iconBtnSm}>
                <AppIcon name="search" size={16} color={healthTheme.navy} />
              </Glass>
            </PressableScale>
            <PressableScale onPress={() => navigation.navigate('DiagnosticsHub')}>
              <Glass variant="health" intensity="medium" radius={20} style={styles.iconBtnSm}>
                <AppIcon name="diagnostics" size={16} color={healthTheme.navy} />
              </Glass>
            </PressableScale>
          </View>
        </View>

        <View style={styles.serviceGrid}>
          {healthServices.map(service => (
            <PressableScale
              key={service.id}
              onPress={service.onPress}
              style={[
                styles.serviceCard,
                service.featured ? styles.serviceCardFeatured : styles.serviceCardDefault,
              ]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: service.featured ? '#fff' : healthTheme.text,
                      fontWeight: '700',
                    },
                  ]}>
                  {service.label}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: service.featured ? 'rgba(255,255,255,0.8)' : healthTheme.textMuted },
                  ]}>
                  {service.price} / session
                </Text>
              </View>
              <View
                style={[
                  styles.serviceArrow,
                  {
                    backgroundColor: service.featured
                      ? 'rgba(255,255,255,0.22)'
                      : healthTheme.navySoft,
                  },
                ]}>
                <AppIcon
                  name="chevron-right"
                  size={16}
                  color={service.featured ? '#fff' : healthTheme.navy}
                />
              </View>
            </PressableScale>
          ))}
        </View>

        <Text style={[theme.typography.section, { color: healthTheme.text, marginTop: 8 }]}>
          Available doctors
        </Text>
        {doctors.map(doc => (
          <Glass
            key={doc.id}
            variant="health"
            intensity="medium"
            radius={healthTheme.radiusMd}
            elevated
            style={styles.doctorRow}>
            <PressableScale
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}
              style={styles.doctorRowMain}>
              <Image source={{ uri: doc.imageUrl }} style={styles.avatar} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[theme.typography.body, { color: healthTheme.text, fontWeight: '700' }]}>
                  {doc.name}
                </Text>
                <Text style={[theme.typography.caption, { color: healthTheme.textMuted }]}>
                  {doc.qualification} · {doc.specialty}
                </Text>
                <Text style={[theme.typography.caption, { color: healthTheme.navy, fontWeight: '600' }]}>
                  ★ {doc.rating} · Rs {doc.fee} · {doc.experienceYears} yrs
                </Text>
              </View>
            </PressableScale>
            <Button
              title="Book"
              variant="health"
              onPress={() =>
                navigation.navigate('Schedule', {
                  kind: 'doctor',
                  id: doc.id,
                  title: doc.name,
                  fee: doc.fee,
                })
              }
            />
          </Glass>
        ))}
      </Glass>
    </HealthScreenShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSm: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredRow: { gap: 14, paddingVertical: 4 },
  featuredCard: {
    width: 220,
    borderRadius: healthTheme.radius,
    overflow: 'hidden',
    backgroundColor: healthTheme.skyMuted,
  },
  featuredPhoto: { width: '100%', height: 160, backgroundColor: healthTheme.skySoft },
  featuredGlass: { margin: 10, marginTop: -28, padding: 12, gap: 4 },
  featuredName: { fontSize: 15, fontWeight: '800', color: healthTheme.text },
  featuredSpec: { fontSize: 12, color: healthTheme.textMuted, fontWeight: '500' },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  featuredIcons: { flexDirection: 'row', gap: 10 },
  featuredGo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: healthTheme.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: { padding: 18, gap: 14 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetActions: { flexDirection: 'row', gap: 8 },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceCard: {
    width: '48%',
    minHeight: 96,
    borderRadius: healthTheme.radiusMd,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  serviceCardDefault: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  serviceCardFeatured: {
    backgroundColor: healthTheme.navy,
  },
  serviceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  doctorRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: healthTheme.skySoft },
});
