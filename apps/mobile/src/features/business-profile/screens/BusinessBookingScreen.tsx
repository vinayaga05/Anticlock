import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { ServiceMode } from '@anticlock/contracts';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken, ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { DateField } from '@/features/provider-onboarding/components/DateTimeFields';
import {
  BusinessWorkspace,
  WorkspaceCard,
  WorkspaceField,
  WorkspaceMessage,
} from '../components/BusinessWorkspace';
import { businessPrice } from '../businessProfileModel';
import { businessToday } from '../businessWorkspaceForms';
import {
  useBusinessAvailabilityQuery,
  useBusinessProfileQuery,
  useCreateBusinessBookingMutation,
} from '../businessProfileHooks';

const MODE_LABEL: Record<ServiceMode, string> = {
  center: 'At the business',
  home: 'Home visit',
  online: 'Online',
};
export function BusinessBookingScreen() {
  const { params } =
    useRoute<RouteProp<RootStackParamList, 'BusinessBooking'>>();
  const { providerId } = params;
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const signedIn = Boolean(user && user.id !== 'temporary-guest');
  const profile = useBusinessProfileQuery(providerId);
  const business = profile.data;
  const [categoryId, setCategoryId] = useState(params.categoryId ?? '');
  const [mode, setMode] = useState<ServiceMode | null>(null);
  const [date, setDate] = useState(businessToday);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const allowLeave = useRef(false);
  const submitting = useRef<object | null>(null);
  const mounted = useRef(true);
  const ownerRef = useRef(user?.id);
  ownerRef.current = user?.id;
  const service = business?.services.find(
    item => item.categoryId === categoryId,
  );
  const duration = service?.durationMinutes ?? 60;
  const availability = useBusinessAvailabilityQuery(
    providerId,
    service && service.available && mode && service.modes.includes(mode)
      ? { categoryId, serviceMode: mode, durationMinutes: duration, date }
      : null,
  );
  const create = useCreateBusinessBookingMutation(providerId);
  const selectedSlot = availability.data?.slots.find(
    slot => slot.startsAt === startsAt && slot.available,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      submitting.current = null;
    };
  }, []);
  useEffect(() => {
    setCategoryId(params.categoryId ?? '');
    setMode(null);
    setStartsAt(null);
    setError(null);
    setUncertain(false);
    setPending(false);
    allowLeave.current = false;
    submitting.current = null;
    setNotes('');
    setAddress('');
  }, [providerId, params.categoryId, user?.id]);
  useEffect(() => {
    if (!categoryId && business)
      setCategoryId(
        business.services.find(item => item.available)?.categoryId ?? '',
      );
  }, [business, categoryId]);
  useEffect(() => {
    if (service && (!mode || !service.modes.includes(mode)))
      setMode(service.modes[0] ?? null);
    setStartsAt(null);
  }, [
    service?.categoryId,
    service?.durationMinutes,
    service?.modes.join(','),
    mode,
    date,
  ]);
  useEffect(() => {
    if (
      startsAt &&
      availability.data &&
      !availability.data.slots.some(
        slot => slot.startsAt === startsAt && slot.available,
      )
    )
      setStartsAt(null);
  }, [availability.data, startsAt]);
  usePreventRemove(pending, ({ data }) => {
    if (allowLeave.current) navigation.dispatch(data.action);
  });

  const submit = async () => {
    if (submitting.current || !signedIn || uncertain) return;
    if (
      !business ||
      !service?.available ||
      !mode ||
      !service.modes.includes(mode) ||
      !selectedSlot ||
      availability.isFetching
    ) {
      setError('Select an available service, date and time.');
      return;
    }
    if (mode === 'home' && !address.trim()) {
      setError('Enter the address for your home visit.');
      return;
    }
    if (notes.trim().length > 1000 || address.trim().length > 500) {
      setError('Keep notes under 1,000 characters and the address under 500.');
      return;
    }
    const current = {};
    const expectedUser = user?.id;
    const expectedToken = getApiToken();
    submitting.current = current;
    setPending(true);
    setError(null);
    const stillHere = () =>
      mounted.current &&
      submitting.current === current &&
      ownerRef.current === expectedUser &&
      getApiToken() === expectedToken;
    try {
      const booking = await create.mutateAsync({
        providerId,
        categoryId,
        category: mode === 'home' ? 'home_service' : 'appointment',
        serviceMode: mode,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        durationMinutes: duration,
        amount: service.price,
        detail: {
          providerName: business.name,
          serviceTitle: service.title,
          locationLabel:
            mode === 'home'
              ? address.trim()
              : mode === 'online'
              ? 'Online'
              : [business.location.address, business.location.city]
                  .filter(Boolean)
                  .join(', '),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      if (!stillHere()) return;
      if (!booking.id || booking.providerId !== providerId)
        throw new Error('The booking confirmation could not be checked.');
      allowLeave.current = true;
      setPending(false);
      navigation.replace('BookingDetail', { bookingId: booking.id });
    } catch (problem) {
      if (!stillHere()) return;
      if (problem instanceof ApiError && problem.status === 409) {
        setStartsAt(null);
        setError('That time is no longer available. Choose another time.');
        void availability.refetch();
      } else if (
        !(problem instanceof ApiError) ||
        problem.status === 0 ||
        problem.status >= 500
      ) {
        setUncertain(true);
        setError(
          'We could not confirm whether your booking was created. Check My bookings before making another request.',
        );
      } else
        setError(
          problem instanceof Error
            ? problem.message
            : 'Could not create your booking. Your details are still here. Try again.',
        );
    } finally {
      if (mounted.current && submitting.current === current) {
        submitting.current = null;
        setPending(false);
      }
    }
  };
  const choose = (category: string) => {
    if (!submitting.current) {
      setCategoryId(category);
      setStartsAt(null);
      setError(null);
    }
  };

  return (
    <BusinessWorkspace
      title="Book a service"
      subtitle={business?.name}
      busy={pending}
      footer={
        signedIn && business ? (
          <>
            {error ? <WorkspaceMessage error>{error}</WorkspaceMessage> : null}
            {uncertain ? (
              <Button
                title="Check My bookings"
                onPress={() => navigation.navigate('MyBookings')}
              />
            ) : (
              <Button
                title="Request booking"
                loading={pending}
                disabled={
                  pending ||
                  !selectedSlot ||
                  availability.isFetching ||
                  !service?.available
                }
                onPress={() => {
                  void submit();
                }}
              />
            )}
          </>
        ) : undefined
      }
    >
      {!signedIn ? (
        <WorkspaceCard>
          <WorkspaceMessage>
            Sign in to book with this business.
          </WorkspaceMessage>
          <Button
            title="Sign in"
            onPress={() => {
              void logout();
            }}
          />
        </WorkspaceCard>
      ) : profile.isLoading ? (
        <WorkspaceMessage>Loading the business…</WorkspaceMessage>
      ) : !business ? (
        <WorkspaceCard>
          <WorkspaceMessage error>
            Could not load the business.
          </WorkspaceMessage>
          <Button
            title="Retry business"
            onPress={() => {
              void profile.refetch();
            }}
          />
        </WorkspaceCard>
      ) : (
        <>
          <WorkspaceCard title="Choose a service">
            {business.services.length ? (
              business.services.map(item => (
                <PressableScale
                  key={item.categoryId}
                  accessibilityLabel={`Select ${item.title}`}
                  accessibilityState={{
                    selected: item.categoryId === categoryId,
                    disabled: pending || !item.available,
                  }}
                  disabled={pending || !item.available}
                  onPress={() => choose(item.categoryId)}
                  style={[
                    styles.option,
                    {
                      backgroundColor:
                        item.categoryId === categoryId
                          ? theme.colors.primarySoft
                          : theme.colors.background,
                      borderColor:
                        item.categoryId === categoryId
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{ color: theme.colors.textSecondary, fontSize: 12 }}
                  >
                    {businessPrice(item.price)} · {item.durationMinutes ?? 60}{' '}
                    min{item.available ? '' : ' · Unavailable'}
                  </Text>
                </PressableScale>
              ))
            ) : (
              <WorkspaceMessage>
                No services are available to book.
              </WorkspaceMessage>
            )}
          </WorkspaceCard>
          {service ? (
            <>
              <WorkspaceCard title="Where and when">
                <View style={styles.row}>
                  {service.modes.map(value => (
                    <Button
                      key={value}
                      title={MODE_LABEL[value]}
                      variant={mode === value ? 'primary' : 'secondary'}
                      disabled={pending}
                      onPress={() => {
                        if (!submitting.current) {
                          setMode(value);
                          setStartsAt(null);
                        }
                      }}
                    />
                  ))}
                </View>
                <View pointerEvents={pending ? 'none' : 'auto'}>
                  <DateField
                    value={date}
                    label="Booking date"
                    onChange={value => {
                      if (value && !submitting.current) {
                        setDate(value);
                        setStartsAt(null);
                      }
                    }}
                  />
                </View>
                <WorkspaceMessage>
                  Times are shown in India Standard Time.
                </WorkspaceMessage>
                {availability.isLoading && mode ? (
                  <WorkspaceMessage>Checking available times…</WorkspaceMessage>
                ) : availability.isError ? (
                  <>
                    <WorkspaceMessage error>
                      Could not check available times.
                    </WorkspaceMessage>
                    <Button
                      title="Retry availability"
                      onPress={() => {
                        void availability.refetch();
                      }}
                    />
                  </>
                ) : availability.data ? (
                  <>
                    {!availability.data.slots.some(slot => slot.available) ? (
                      <WorkspaceMessage>
                        {availability.data.reason ||
                          'No times are available on this date. Choose another date.'}
                      </WorkspaceMessage>
                    ) : null}
                    <View style={styles.row}>
                      {availability.data.slots.map(slot => (
                        <PressableScale
                          key={slot.startsAt}
                          accessibilityLabel={`Time ${new Date(
                            slot.startsAt,
                          ).toLocaleTimeString('en-IN', {
                            timeZone: availability.data!.timeZone,
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`}
                          accessibilityState={{
                            selected: startsAt === slot.startsAt,
                            disabled: pending || !slot.available,
                          }}
                          disabled={pending || !slot.available}
                          onPress={() => {
                            if (!submitting.current) setStartsAt(slot.startsAt);
                          }}
                          style={[
                            styles.slot,
                            {
                              borderColor:
                                startsAt === slot.startsAt
                                  ? theme.colors.primary
                                  : theme.colors.border,
                              backgroundColor:
                                startsAt === slot.startsAt
                                  ? theme.colors.primarySoft
                                  : theme.colors.background,
                              opacity: slot.available ? 1 : 0.45,
                            },
                          ]}
                        >
                          <Text style={{ color: theme.colors.textPrimary }}>
                            {new Date(slot.startsAt).toLocaleTimeString(
                              'en-IN',
                              {
                                timeZone: availability.data!.timeZone,
                                hour: 'numeric',
                                minute: '2-digit',
                              },
                            )}
                          </Text>
                        </PressableScale>
                      ))}
                    </View>
                  </>
                ) : null}
              </WorkspaceCard>
              <WorkspaceCard title="Your request">
                {mode === 'home' ? (
                  <WorkspaceField
                    label="Service address"
                    value={address}
                    onChangeText={value => {
                      if (!submitting.current) setAddress(value);
                    }}
                    disabled={pending}
                    maxLength={500}
                    multiline
                  />
                ) : null}
                <WorkspaceField
                  label="Notes for the business"
                  value={notes}
                  onChangeText={value => {
                    if (!submitting.current) setNotes(value);
                  }}
                  disabled={pending}
                  maxLength={1000}
                  multiline
                  placeholder="Anything the team should know?"
                />
                <WorkspaceMessage>
                  The business will confirm your request.{' '}
                  {service.price == null
                    ? 'Ask the business about pricing.'
                    : `Listed price: ${businessPrice(service.price)}.`}
                </WorkspaceMessage>
              </WorkspaceCard>
            </>
          ) : null}
        </>
      )}
    </BusinessWorkspace>
  );
}
const styles = StyleSheet.create({
  option: {
    minHeight: 60,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 7,
  },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  slot: {
    minHeight: 44,
    minWidth: 90,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
