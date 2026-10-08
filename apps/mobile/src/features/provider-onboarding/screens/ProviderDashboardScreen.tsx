import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useMyBusinessQuery,
  useUpdateMyBusinessMutation,
} from '@/shared/api/providerHooks';
import type {
  ProviderBusinessDetail,
  UpdateProviderBusinessRequest,
} from '@/features/provider-onboarding/types';
import {
  TimeField,
  formatTimeLabel,
} from '@/features/provider-onboarding/components/DateTimeFields';
import {
  parseNumberInput,
  statusLabel,
} from '@/features/provider-onboarding/utils/formValues';
import { ProviderBusinessesScreen } from './ProviderBusinessesScreen';

/**
 * Stable destination for legacy links and Genie navigation. With a
 * providerId it is that business's dashboard; without one it lists all
 * businesses (unchanged behaviour).
 */
export function ProviderDashboardScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderDashboard'>>();
  const providerId = route.params?.providerId;
  if (!providerId) return <ProviderBusinessesScreen />;
  return <BusinessDashboard providerId={providerId} />;
}

type EditDraft = {
  description: string;
  contactPerson: string;
  mobile: string;
  email: string;
  pricingStartsAt: string;
  openingTime: string | null;
  closingTime: string | null;
};

function draftFrom(business: ProviderBusinessDetail): EditDraft {
  return {
    description: business.profile.description ?? '',
    contactPerson: business.profile.contactPerson ?? '',
    mobile: business.profile.mobile ?? '',
    email: business.profile.email ?? '',
    pricingStartsAt:
      business.profile.pricingStartsAt == null
        ? ''
        : String(business.profile.pricingStartsAt),
    openingTime: business.profile.openingTime,
    closingTime: business.profile.closingTime,
  };
}

function BusinessDashboard({ providerId }: { providerId: string }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const query = useMyBusinessQuery(providerId);
  const update = useUpdateMyBusinessMutation(providerId);
  const business = query.data;
  const [editing, setEditing] = useState<EditDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const save = async () => {
    if (!editing) return;
    const body: UpdateProviderBusinessRequest = {
      description: editing.description.trim(),
      contactPerson: editing.contactPerson.trim(),
      mobile: editing.mobile.trim(),
      email: editing.email.trim(),
    };
    if (editing.pricingStartsAt.trim()) {
      const price = parseNumberInput(editing.pricingStartsAt);
      if (price === null || price < 0) {
        Alert.alert('Check the price', 'Starting price must be a number.');
        return;
      }
      body.pricingStartsAt = price;
    }
    if (editing.openingTime) body.openingTime = editing.openingTime;
    if (editing.closingTime) body.closingTime = editing.closingTime;
    try {
      await update.mutateAsync(body);
      setEditing(null);
    } catch (err) {
      Alert.alert('Could not save', (err as Error).message);
    }
  };

  const card = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderSoft,
    },
  ];
  const input = [
    styles.input,
    { color: theme.colors.textPrimary, borderColor: theme.colors.borderSoft },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 60 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <View style={styles.topBar}>
          <PressableScale
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={[
              styles.back,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <AppIcon name="back" size={21} color={theme.colors.textPrimary} />
          </PressableScale>
          <Text style={[styles.topTitle, { color: theme.colors.textPrimary }]}>
            Business dashboard
          </Text>
          <View style={styles.back} />
        </View>

        {query.isLoading ? (
          <Text
            style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
          >
            Loading…
          </Text>
        ) : !business ? (
          <View style={card}>
            <Text
              style={{ color: theme.colors.textPrimary, fontWeight: '700' }}
            >
              We couldn’t open this business
            </Text>
            <Text style={{ color: theme.colors.textSecondary }}>
              {query.error instanceof Error
                ? query.error.message
                : 'Please try again.'}
            </Text>
            <Button title="Try again" onPress={() => void query.refetch()} />
          </View>
        ) : (
          <>
            <View style={card}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.colors.primarySoft },
                  ]}
                >
                  {business.avatarUrl ? (
                    <Image
                      source={{ uri: business.avatarUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <AppIcon
                      name="shop"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </View>
                <View style={styles.flex1}>
                  <Text
                    style={[styles.name, { color: theme.colors.textPrimary }]}
                  >
                    {business.name}
                  </Text>
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {business.categories.map(c => c.name).join(', ') ||
                      'No services'}
                  </Text>
                  <Text
                    style={{
                      color:
                        business.status === 'active'
                          ? theme.colors.success
                          : theme.colors.warning,
                      fontWeight: '700',
                    }}
                  >
                    {business.status === 'active'
                      ? 'Live in marketplace'
                      : statusLabel(business.status)}
                  </Text>
                </View>
              </View>
              <Button
                title="View public page"
                variant="secondary"
                icon="globe"
                onPress={() =>
                  navigation.navigate('UniversalDetail', {
                    entityType: 'provider',
                    entityId: business.id,
                    categoryId: business.categories[0]?.id ?? '',
                  })
                }
              />
            </View>

            <View style={styles.stats}>
              {[
                { label: 'Services', value: business.counts.services },
                { label: 'Upcoming', value: business.counts.upcomingBookings },
                { label: 'All bookings', value: business.counts.totalBookings },
              ].map(stat => (
                <View key={stat.label} style={[styles.stat, ...card]}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={{ color: theme.colors.textSecondary, fontSize: 12 }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={card}>
              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  Profile
                </Text>
                {editing ? null : (
                  <PressableScale
                    onPress={() => setEditing(draftFrom(business))}
                  >
                    <Text
                      style={{
                        color: theme.colors.primaryMuted,
                        fontWeight: '700',
                      }}
                    >
                      Edit
                    </Text>
                  </PressableScale>
                )}
              </View>
              {editing ? (
                <View style={styles.form}>
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Description
                  </Text>
                  <TextInput
                    style={[...input, styles.textarea]}
                    multiline
                    value={editing.description}
                    onChangeText={description =>
                      setEditing({ ...editing, description })
                    }
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Contact person
                  </Text>
                  <TextInput
                    style={input}
                    value={editing.contactPerson}
                    onChangeText={contactPerson =>
                      setEditing({ ...editing, contactPerson })
                    }
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Mobile
                  </Text>
                  <TextInput
                    style={input}
                    keyboardType="phone-pad"
                    value={editing.mobile}
                    onChangeText={mobile => setEditing({ ...editing, mobile })}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Email
                  </Text>
                  <TextInput
                    style={input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={editing.email}
                    onChangeText={email => setEditing({ ...editing, email })}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Starting price (₹)
                  </Text>
                  <TextInput
                    style={input}
                    keyboardType="decimal-pad"
                    value={editing.pricingStartsAt}
                    onChangeText={pricingStartsAt =>
                      setEditing({ ...editing, pricingStartsAt })
                    }
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Opens
                  </Text>
                  <TimeField
                    label="Opening time"
                    value={editing.openingTime}
                    onChange={openingTime =>
                      setEditing({ ...editing, openingTime })
                    }
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    Closes
                  </Text>
                  <TimeField
                    label="Closing time"
                    value={editing.closingTime}
                    onChange={closingTime =>
                      setEditing({ ...editing, closingTime })
                    }
                  />
                  <View style={styles.row}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={() => setEditing(null)}
                      style={styles.flex1}
                    />
                    <Button
                      title="Save"
                      onPress={() => void save()}
                      loading={update.isPending}
                      style={styles.flex1}
                    />
                  </View>
                </View>
              ) : (
                <>
                  {business.profile.description ? (
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {business.profile.description}
                    </Text>
                  ) : null}
                  {[
                    ['Contact', business.profile.contactPerson],
                    ['Mobile', business.profile.mobile],
                    ['Email', business.profile.email],
                    [
                      'Address',
                      [
                        business.profile.address,
                        business.profile.area,
                        business.profile.city,
                      ]
                        .filter(Boolean)
                        .join(', '),
                    ],
                    [
                      'Hours',
                      business.profile.openingTime &&
                      business.profile.closingTime
                        ? `${formatTimeLabel(
                            business.profile.openingTime,
                          )} – ${formatTimeLabel(business.profile.closingTime)}`
                        : null,
                    ],
                    [
                      'Starts at',
                      business.profile.pricingStartsAt != null
                        ? `₹${business.profile.pricingStartsAt}`
                        : null,
                    ],
                  ].map(([label, value]) => (
                    <View key={label as string} style={styles.kv}>
                      <Text
                        style={[
                          styles.label,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          color: value
                            ? theme.colors.textPrimary
                            : theme.colors.textTertiary,
                        }}
                      >
                        {value || '—'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={card}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.textPrimary }]}
              >
                Services
              </Text>
              {business.services.length ? (
                business.services.map(service => (
                  <View key={service.categoryId} style={styles.kvRow}>
                    <Text
                      style={[
                        styles.flex1,
                        { color: theme.colors.textPrimary },
                      ]}
                    >
                      {service.name}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary }}>
                      {service.pricingStartsAt != null
                        ? `from ₹${service.pricingStartsAt}`
                        : ''}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.colors.textTertiary }}>
                  No services listed.
                </Text>
              )}
            </View>

            <View style={card}>
              <Text
                style={[styles.cardTitle, { color: theme.colors.textPrimary }]}
              >
                Upcoming bookings
              </Text>
              {business.upcomingBookings.length ? (
                business.upcomingBookings.map(booking => (
                  <View key={booking.id} style={styles.kvRow}>
                    <View style={styles.flex1}>
                      <Text
                        style={{
                          color: theme.colors.textPrimary,
                          fontWeight: '700',
                        }}
                      >
                        {booking.customerName}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.textSecondary,
                          fontSize: 12,
                        }}
                      >
                        {booking.serviceTitle} · {booking.serviceMode}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: theme.colors.textSecondary,
                        fontSize: 12,
                        textAlign: 'right',
                      }}
                    >
                      {new Date(booking.startsAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {'\n'}
                      {statusLabel(booking.status)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.colors.textTertiary }}>
                  No upcoming bookings yet.
                </Text>
              )}
            </View>

            <Button
              title="All my businesses"
              variant="secondary"
              onPress={() => navigation.navigate('ProviderBusinesses')}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingHorizontal: 20 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topTitle: { fontSize: 17, fontWeight: '800' },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  avatar: {
    alignItems: 'center',
    borderRadius: 18,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  avatarImage: { height: 60, width: 60 },
  name: { fontSize: 19, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  form: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  textarea: { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' },
  kv: { gap: 2 },
  kvRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
});
