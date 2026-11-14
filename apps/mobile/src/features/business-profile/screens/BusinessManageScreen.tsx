import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { BusinessProfile, ServiceMode } from '@anticlock/contracts';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { MapLocationField } from '@/features/provider-onboarding/components/MapLocationField';
import {
  pickProfilePhoto,
  type PickedProfilePhoto,
} from '@/features/profile/utils/profilePhoto';
import {
  BusinessWorkspace,
  WorkspaceCard,
  WorkspaceField,
  WorkspaceMessage,
} from '../components/BusinessWorkspace';
import {
  useBusinessAnalyticsQuery,
  useBusinessProfileQuery,
  useBusinessServiceCatalogQuery,
  useUpdateBusinessProfileMutation,
  useUpdateBusinessServicesMutation,
} from '../businessProfileHooks';
import { businessPrice } from '../businessProfileModel';
import {
  buildBusinessProfileUpdate,
  buildBusinessServicesUpdate,
  businessProfileDraft,
  businessServiceDraft,
  WORKING_DAYS,
  type BusinessProfileDraft,
  type BusinessServiceDraft,
} from '../businessWorkspaceForms';
import { uploadBusinessImage } from '../businessMedia';

type Section = 'profile' | 'services' | 'analytics';
type MediaItem = {
  id?: string;
  uri: string;
  photo?: PickedProfilePhoto;
  kind: 'image' | 'video';
};
const MODES: { id: ServiceMode; label: string }[] = [
  { id: 'center', label: 'At business' },
  { id: 'home', label: 'Home visit' },
  { id: 'online', label: 'Online' },
];

export function BusinessManageScreen() {
  const { params } =
    useRoute<RouteProp<RootStackParamList, 'BusinessManage'>>();
  const { providerId } = params;
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { identities } = useActiveProfile();
  const signedIn = Boolean(user && user.id !== 'temporary-guest');
  const profile = useBusinessProfileQuery(providerId);
  const business = profile.data;
  const [section, setSection] = useState<Section>(params.section ?? 'profile');
  const [draft, setDraft] = useState<BusinessProfileDraft | null>(null);
  const [services, setServices] = useState<BusinessServiceDraft[]>([]);
  const [logo, setLogo] = useState<PickedProfilePhoto | null | undefined>();
  const [cover, setCover] = useState<PickedProfilePhoto | null | undefined>();
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [baseline, setBaseline] = useState({
    profile: '',
    services: '',
    gallery: '',
  });
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const hydrated = useRef('');
  const operation = useRef<{ controller: AbortController } | null>(null);
  const picker = useRef<object | null>(null);
  const mounted = useRef(true);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const uploaded = useRef(new Map<PickedProfilePhoto, string>());
  const saveProfile = useUpdateBusinessProfileMutation(providerId);
  const saveServices = useUpdateBusinessServicesMutation(providerId);
  const analytics = useBusinessAnalyticsQuery(
    providerId,
    section === 'analytics' && business?.viewer.canViewAnalytics === true,
  );
  const catalog = useBusinessServiceCatalogQuery(
    business?.providerKind,
    section === 'services' && business?.viewer.canEditServices === true,
  );
  const dirty =
    draft !== null &&
    (JSON.stringify(draft) !== baseline.profile ||
      JSON.stringify(services) !== baseline.services ||
      logo !== undefined ||
      cover !== undefined ||
      JSON.stringify(gallery.map(item => item.id ?? item.uri)) !==
        baseline.gallery);
  const busy = pending || picking;
  const identity = identities.find(
    item =>
      item.id === providerId &&
      identityProfileType(item) === 'business' &&
      item.role !== 'analyst',
  );

  const apply = (value: BusinessProfile) => {
    const next = businessProfileDraft(value);
    const nextServices = value.services.map(businessServiceDraft);
    const nextGallery = value.gallery.map(item => ({
      id: item.id,
      uri: item.url,
      kind: item.kind,
    }));
    setDraft(next);
    setServices(nextServices);
    setGallery(nextGallery);
    setLogo(undefined);
    setCover(undefined);
    uploaded.current.clear();
    setBaseline({
      profile: JSON.stringify(next),
      services: JSON.stringify(nextServices),
      gallery: JSON.stringify(nextGallery.map(item => item.id)),
    });
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.controller.abort();
      operation.current = null;
      picker.current = null;
    };
  }, []);
  useEffect(() => {
    operation.current?.controller.abort();
    operation.current = null;
    picker.current = null;
    uploaded.current.clear();
    hydrated.current = '';
    setDraft(null);
    setPending(false);
    setPicking(false);
    setError(null);
    setStatus('');
    setSection(params.section ?? 'profile');
  }, [providerId, user?.id, params.section]);
  useEffect(() => {
    const key = `${user?.id}:${providerId}`;
    if (business && hydrated.current !== key) {
      apply(business);
      hydrated.current = key;
    }
  }, [business, providerId, user?.id]);
  useEffect(() => {
    if (!business) return;
    const allowed =
      section === 'profile'
        ? business.viewer.canManage
        : section === 'services'
        ? business.viewer.canEditServices
        : business.viewer.canViewAnalytics;
    if (!allowed) {
      if (business.viewer.canManage) setSection('profile');
      else if (business.viewer.canEditServices) setSection('services');
      else if (business.viewer.canViewAnalytics) setSection('analytics');
    }
  }, [business, section]);
  usePreventRemove(busy || dirty, ({ data }) => {
    if (operation.current || picker.current) return;
    Alert.alert(
      'Discard changes?',
      'Your business changes have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  const markEdited = () => {
    setStatus('');
    setError(null);
  };
  const change = <K extends keyof BusinessProfileDraft>(
    key: K,
    value: BusinessProfileDraft[K],
  ) => {
    if (!operation.current && !picker.current) {
      setDraft(current => (current ? { ...current, [key]: value } : current));
      setStatus('');
      setError(null);
    }
  };
  const changeService = (
    index: number,
    patch: Partial<BusinessServiceDraft>,
  ) => {
    if (!operation.current && !picker.current) {
      setServices(current =>
        current.map((item, position) =>
          position === index ? { ...item, ...patch } : item,
        ),
      );
      setStatus('');
      setError(null);
    }
  };
  const switchSection = (value: Section) => {
    if (operation.current || picker.current || section === value) return;
    if (dirty && business)
      Alert.alert(
        'Discard changes?',
        'Save your changes before switching sections, or discard them.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              apply(business);
              setSection(value);
              setError(null);
              setStatus('');
            },
          },
        ],
      );
    else {
      setSection(value);
      setError(null);
      setStatus('');
    }
  };
  const pick = async (
    target: 'logo' | 'cover' | 'gallery',
    source: 'camera' | 'library' = 'library',
  ) => {
    if (operation.current || picker.current || !business?.viewer.canManage)
      return;
    if (target === 'gallery' && gallery.length >= 20) {
      setError('Use up to 20 gallery items.');
      return;
    }
    const request = {};
    const expectedUser = user?.id;
    const expectedToken = getApiToken();
    picker.current = request;
    setPicking(true);
    setError(null);
    setSettings(false);
    try {
      const photo = await pickProfilePhoto(source);
      if (
        !mounted.current ||
        picker.current !== request ||
        owner.current !== expectedUser ||
        getApiToken() !== expectedToken ||
        !photo
      )
        return;
      if (target === 'logo') setLogo(photo);
      else if (target === 'cover') setCover(photo);
      else
        setGallery(current => [
          ...current,
          { uri: photo.uri, photo, kind: 'image' },
        ]);
      setStatus('');
    } catch (problem) {
      if (mounted.current && picker.current === request) {
        setError(
          problem instanceof Error
            ? problem.message
            : 'Could not select an image. Try again.',
        );
        setSettings(
          (problem as { code?: string }).code === 'permission_denied',
        );
      }
    } finally {
      if (mounted.current && picker.current === request) {
        picker.current = null;
        setPicking(false);
      }
    }
  };
  const save = async () => {
    if (operation.current || picker.current || !business || !draft || !dirty)
      return;
    if (
      section === 'profile'
        ? !business.viewer.canManage
        : section === 'services'
        ? !business.viewer.canEditServices
        : true
    )
      return;
    let profileBody;
    let serviceBody;
    try {
      if (section === 'profile') {
        if (business.description && !draft.description.trim())
          throw new Error('Describe your business in at least 10 characters.');
        if (
          (business.availability.openingTime ||
            business.availability.closingTime) &&
          (!draft.openingTime.trim() || !draft.closingTime.trim())
        )
          throw new Error(
            'Keep both opening and closing times set. Use temporary unavailability to pause bookings.',
          );
        profileBody = buildBusinessProfileUpdate(draft);
      } else serviceBody = buildBusinessServicesUpdate(services);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'Check the business details.',
      );
      return;
    }
    const current = { controller: new AbortController() };
    const expectedUser = user?.id;
    const expectedToken = getApiToken();
    operation.current = current;
    setPending(true);
    setError(null);
    setStatus('Saving changes…');
    const isCurrent = () =>
      mounted.current &&
      operation.current === current &&
      owner.current === expectedUser &&
      getApiToken() === expectedToken &&
      !current.controller.signal.aborted;
    try {
      let updated: BusinessProfile;
      if (section === 'profile' && profileBody) {
        const media = [
          ...(logo ? [logo] : []),
          ...(cover ? [cover] : []),
          ...gallery.flatMap(item => (item.photo ? [item.photo] : [])),
        ];
        if (media.length && !identity)
          throw new Error(
            'Your publishing access is unavailable. Reopen the business profile to try again.',
          );
        let count = 0;
        for (const photo of media) {
          if (!isCurrent()) return;
          if (!uploaded.current.has(photo)) {
            setStatus(`Uploading image ${++count} of ${media.length}…`);
            const id = await uploadBusinessImage(
              identity!,
              photo,
              current.controller.signal,
            );
            if (!isCurrent()) return;
            uploaded.current.set(photo, id);
          }
        }
        if (logo !== undefined)
          profileBody.logoMediaId = logo ? uploaded.current.get(logo)! : null;
        if (cover !== undefined)
          profileBody.coverMediaId = cover
            ? uploaded.current.get(cover)!
            : null;
        if (
          JSON.stringify(gallery.map(item => item.id ?? item.uri)) !==
          baseline.gallery
        )
          profileBody.galleryMediaIds = gallery.map(item =>
            item.photo ? uploaded.current.get(item.photo)! : item.id!,
          );
        if (!isCurrent()) return;
        setStatus('Saving business profile…');
        updated = (await saveProfile.mutateAsync(profileBody)).business;
      } else {
        if (!serviceBody || !isCurrent()) return;
        updated = (await saveServices.mutateAsync(serviceBody)).business;
      }
      if (!isCurrent()) return;
      apply(updated);
      setStatus('Changes saved');
    } catch (problem) {
      if (
        mounted.current &&
        operation.current === current &&
        owner.current === expectedUser
      ) {
        setError(
          problem instanceof Error
            ? problem.message
            : 'Could not save. Your changes are still here. Try again.',
        );
        setStatus('');
      }
    } finally {
      if (mounted.current && operation.current === current) {
        operation.current = null;
        setPending(false);
      }
    }
  };
  const canEdit =
    section === 'profile'
      ? business?.viewer.canManage
      : section === 'services'
      ? business?.viewer.canEditServices
      : false;
  const tabOptions = [
    {
      id: 'profile' as const,
      label: 'Profile',
      allowed: business?.viewer.canManage,
    },
    {
      id: 'services' as const,
      label: 'Services',
      allowed: business?.viewer.canEditServices,
    },
    {
      id: 'analytics' as const,
      label: 'Analytics',
      allowed: business?.viewer.canViewAnalytics,
    },
  ];
  const visibleCatalog = (catalog.data ?? [])
    .filter(
      item =>
        !services.some(service => service.categoryId === item.id) &&
        item.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .slice(0, 20);
  const profileField = (
    label: string,
    key: keyof BusinessProfileDraft,
    maxLength: number,
    multiline = false,
    keyboardType?:
      | 'default'
      | 'url'
      | 'email-address'
      | 'phone-pad'
      | 'decimal-pad'
      | 'number-pad',
  ) => (
    <WorkspaceField
      label={label}
      value={String(draft?.[key] ?? '')}
      onChangeText={value => change(key, value as never)}
      maxLength={maxLength}
      multiline={multiline}
      disabled={busy}
      keyboardType={keyboardType}
    />
  );

  return (
    <BusinessWorkspace
      title="Business workspace"
      subtitle={business?.name}
      busy={busy}
      footer={
        signedIn && canEdit && draft ? (
          <>
            {error ? <WorkspaceMessage error>{error}</WorkspaceMessage> : null}
            {status ? (
              <WorkspaceMessage>{status}</WorkspaceMessage>
            ) : (
              <WorkspaceMessage>
                {dirty ? 'Unsaved changes' : 'All up to date'}
              </WorkspaceMessage>
            )}
            <Button
              title="Save business changes"
              loading={pending}
              disabled={!dirty || busy}
              onPress={() => {
                void save();
              }}
            />
            {settings ? (
              <Button
                title="Open Settings"
                variant="secondary"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            ) : null}
          </>
        ) : undefined
      }
    >
      {!signedIn ? (
        <WorkspaceCard>
          <WorkspaceMessage>Sign in to manage your business.</WorkspaceMessage>
          <Button
            title="Sign in"
            onPress={() => {
              void logout();
            }}
          />
        </WorkspaceCard>
      ) : profile.isLoading ? (
        <WorkspaceMessage>Loading your business…</WorkspaceMessage>
      ) : !business ? (
        <WorkspaceCard>
          <WorkspaceMessage error>
            Could not open the business workspace.
          </WorkspaceMessage>
          <Button
            title="Retry business"
            onPress={() => {
              void profile.refetch();
            }}
          />
        </WorkspaceCard>
      ) : !tabOptions.some(tab => tab.allowed) ? (
        <WorkspaceMessage>
          You do not have access to manage this business.
        </WorkspaceMessage>
      ) : (
        <>
          <View style={styles.row}>
            {tabOptions
              .filter(tab => tab.allowed)
              .map(tab => (
                <Button
                  key={tab.id}
                  title={tab.label}
                  variant={section === tab.id ? 'primary' : 'secondary'}
                  disabled={busy}
                  onPress={() => switchSection(tab.id)}
                />
              ))}
          </View>
          {section === 'profile' && business.viewer.canManage && draft ? (
            <>
              <WorkspaceCard title="Business identity">
                {profileField('Business name', 'name', 160)}
                {profileField('Tagline', 'tagline', 160)}
                {profileField('About the business', 'description', 2000, true)}
                {profileField('Brand color', 'brandAccentColor', 7)}
                {profileField(
                  'Years in business',
                  'yearsInBusiness',
                  3,
                  false,
                  'number-pad',
                )}
                {profileField(
                  'Certifications (one per line)',
                  'certifications',
                  2500,
                  true,
                )}
                {profileField('Languages (comma separated)', 'languages', 1200)}
              </WorkspaceCard>
              <WorkspaceCard title="Photos">
                {(['logo', 'cover'] as const).map(target => {
                  const selected = target === 'logo' ? logo : cover;
                  const uri =
                    selected === undefined
                      ? target === 'logo'
                        ? business.avatarUrl
                        : business.coverUrl
                      : selected?.uri;
                  return (
                    <View key={target} style={{ gap: 10 }}>
                      <Text
                        style={{
                          color: theme.colors.textPrimary,
                          fontWeight: '600',
                        }}
                      >
                        {target === 'logo' ? 'Business logo' : 'Cover image'}
                      </Text>
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={[
                            styles.image,
                            target === 'logo' && styles.logo,
                          ]}
                        />
                      ) : (
                        <WorkspaceMessage>
                          {target === 'logo'
                            ? 'No logo selected.'
                            : 'No cover selected.'}
                        </WorkspaceMessage>
                      )}
                      <View style={styles.row}>
                        <Button
                          title={`${
                            target === 'logo' ? 'Logo' : 'Cover'
                          } camera`}
                          icon="camera"
                          disabled={busy}
                          variant="secondary"
                          onPress={() => {
                            void pick(target, 'camera');
                          }}
                        />
                        <Button
                          title={`${
                            target === 'logo' ? 'Logo' : 'Cover'
                          } gallery`}
                          icon="images"
                          disabled={busy}
                          variant="secondary"
                          onPress={() => {
                            void pick(target);
                          }}
                        />
                        {uri ? (
                          <Button
                            title={`Remove ${target}`}
                            disabled={busy}
                            variant="ghost"
                            onPress={() => {
                              if (!operation.current && !picker.current) {
                                target === 'logo'
                                  ? setLogo(null)
                                  : setCover(null);
                                markEdited();
                              }
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                <Text
                  style={{ color: theme.colors.textPrimary, fontWeight: '600' }}
                >
                  Gallery · {gallery.length}/20
                </Text>
                <View style={styles.gallery}>
                  {gallery.map((item, index) => (
                    <View key={item.id ?? item.uri} style={styles.galleryItem}>
                      {item.kind === 'image' ? (
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.galleryImage}
                        />
                      ) : (
                        <WorkspaceMessage>Video</WorkspaceMessage>
                      )}
                      <Button
                        title={`Remove item ${index + 1}`}
                        variant="ghost"
                        disabled={busy}
                        onPress={() => {
                          if (!operation.current && !picker.current) {
                            setGallery(current =>
                              current.filter(
                                (_, position) => position !== index,
                              ),
                            );
                            markEdited();
                          }
                        }}
                      />
                    </View>
                  ))}
                </View>
                <Button
                  title="Add gallery photo"
                  icon="plus"
                  variant="secondary"
                  disabled={busy || gallery.length >= 20}
                  onPress={() => {
                    void pick('gallery');
                  }}
                />
                <WorkspaceMessage>
                  Selected photos are uploaded when you save.
                </WorkspaceMessage>
              </WorkspaceCard>
              <WorkspaceCard title="Contact">
                {profileField('Contact phone', 'phone', 20, false, 'phone-pad')}
                {profileField(
                  'Contact email',
                  'email',
                  254,
                  false,
                  'email-address',
                )}
                {profileField('Website', 'website', 2000, false, 'url')}
              </WorkspaceCard>
              <WorkspaceCard title="Location">
                {profileField('Business address', 'address', 500, true)}
                {profileField('City', 'city', 100)}
                {profileField('Area', 'area', 100)}
                {profileField('Postal code', 'pincode', 12)}
                <View pointerEvents={busy ? 'none' : 'auto'}>
                  <MapLocationField
                    value={
                      draft.latitude && draft.longitude
                        ? {
                            latitude: draft.latitude,
                            longitude: draft.longitude,
                          }
                        : null
                    }
                    addressQuery={[draft.address, draft.city]
                      .filter(Boolean)
                      .join(', ')}
                    onChange={point => {
                      if (!operation.current && !picker.current) {
                        setDraft(current =>
                          current ? { ...current, ...point } : current,
                        );
                        markEdited();
                      }
                    }}
                  />
                </View>
                {profileField(
                  'Service radius (km)',
                  'serviceRadiusKm',
                  6,
                  false,
                  'decimal-pad',
                )}
              </WorkspaceCard>
              <WorkspaceCard title="Working hours">
                <View style={styles.row}>
                  {WORKING_DAYS.map(day => (
                    <PressableScale
                      key={day}
                      accessibilityLabel={`Working day ${day}`}
                      accessibilityState={{
                        selected: draft.workingDays.includes(day),
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => {
                        if (
                          draft.workingDays.includes(day) &&
                          draft.workingDays.length === 1
                        ) {
                          setError(
                            'Keep at least one working day. Pause bookings using temporary unavailability.',
                          );
                          return;
                        }
                        change(
                          'workingDays',
                          draft.workingDays.includes(day)
                            ? draft.workingDays.filter(value => value !== day)
                            : [...draft.workingDays, day],
                        );
                      }}
                      style={[
                        styles.day,
                        {
                          backgroundColor: draft.workingDays.includes(day)
                            ? theme.colors.primarySoft
                            : theme.colors.background,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: theme.colors.textPrimary }}>
                        {day}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
                {profileField('Opens at (HH:MM)', 'openingTime', 5)}
                {profileField('Closes at (HH:MM)', 'closingTime', 5)}
                <WorkspaceMessage>
                  Working hours use India Standard Time.
                </WorkspaceMessage>
                <View style={styles.between}>
                  <Text style={{ color: theme.colors.textPrimary, flex: 1 }}>
                    Temporarily unavailable
                  </Text>
                  <Switch
                    accessibilityLabel="Temporarily unavailable"
                    value={draft.temporarilyUnavailable}
                    disabled={busy}
                    onValueChange={value =>
                      change('temporarilyUnavailable', value)
                    }
                  />
                </View>
              </WorkspaceCard>
            </>
          ) : null}
          {section === 'services' && business.viewer.canEditServices ? (
            <>
              {services.map((service, index) => (
                <WorkspaceCard key={service.categoryId} title={service.title}>
                  <WorkspaceField
                    label={`${service.title} description`}
                    value={service.description}
                    onChangeText={value =>
                      changeService(index, { description: value })
                    }
                    maxLength={1000}
                    disabled={busy}
                    multiline
                  />
                  <WorkspaceField
                    label={`${service.title} price (₹)`}
                    value={service.price}
                    onChangeText={value =>
                      changeService(index, { price: value })
                    }
                    keyboardType="number-pad"
                    disabled={busy}
                  />
                  <WorkspaceField
                    label={`${service.title} duration (minutes)`}
                    value={service.durationMinutes}
                    onChangeText={value =>
                      changeService(index, { durationMinutes: value })
                    }
                    keyboardType="number-pad"
                    disabled={busy}
                  />
                  <View style={styles.row}>
                    {MODES.map(mode => (
                      <Button
                        key={mode.id}
                        title={mode.label}
                        variant={
                          service.modes.includes(mode.id)
                            ? 'primary'
                            : 'secondary'
                        }
                        disabled={busy}
                        onPress={() =>
                          changeService(index, {
                            modes: service.modes.includes(mode.id)
                              ? service.modes.filter(value => value !== mode.id)
                              : [...service.modes, mode.id],
                          })
                        }
                      />
                    ))}
                  </View>
                  <View style={styles.between}>
                    <Text style={{ color: theme.colors.textPrimary, flex: 1 }}>
                      Available to book
                    </Text>
                    <Switch
                      accessibilityLabel={`${service.title} available`}
                      value={service.available}
                      disabled={busy}
                      onValueChange={value =>
                        changeService(index, { available: value })
                      }
                    />
                  </View>
                  <Button
                    title={`Remove ${service.title}`}
                    variant="destructive"
                    disabled={busy || services.length <= 1}
                    onPress={() => {
                      if (!operation.current && !picker.current) {
                        setServices(current =>
                          current.filter((_, position) => position !== index),
                        );
                        markEdited();
                      }
                    }}
                  />
                </WorkspaceCard>
              ))}
              <WorkspaceCard title="Add a service">
                <WorkspaceField
                  label="Search service categories"
                  value={search}
                  onChangeText={setSearch}
                  disabled={busy}
                  placeholder="Find a service category"
                />
                {catalog.isLoading ? (
                  <WorkspaceMessage>
                    Loading service categories…
                  </WorkspaceMessage>
                ) : catalog.isError ? (
                  <>
                    <WorkspaceMessage error>
                      Could not load categories.
                    </WorkspaceMessage>
                    <Button
                      title="Retry categories"
                      onPress={() => {
                        void catalog.refetch();
                      }}
                    />
                  </>
                ) : visibleCatalog.length ? (
                  visibleCatalog.map(item => (
                    <Button
                      key={item.id}
                      title={`Add ${item.name}`}
                      variant="secondary"
                      disabled={busy || services.length >= 20}
                      onPress={() => {
                        if (!operation.current && !picker.current) {
                          setServices(current => [
                            ...current,
                            {
                              categoryId: item.id,
                              title: item.name,
                              description: '',
                              price: '',
                              durationMinutes: '60',
                              modes: ['center'],
                              available: true,
                            },
                          ]);
                          markEdited();
                        }
                      }}
                    />
                  ))
                ) : (
                  <WorkspaceMessage>
                    No additional categories match this search.
                  </WorkspaceMessage>
                )}
              </WorkspaceCard>
            </>
          ) : null}
          {section === 'analytics' && business.viewer.canViewAnalytics ? (
            <>
              <WorkspaceCard title="Business analytics">
                <WorkspaceMessage>
                  All-time activity recorded for this business.
                </WorkspaceMessage>
                {analytics.isLoading ? (
                  <WorkspaceMessage>Loading analytics…</WorkspaceMessage>
                ) : analytics.isError || !analytics.data ? (
                  <>
                    <WorkspaceMessage error>
                      Could not load analytics.
                    </WorkspaceMessage>
                    <Button
                      title="Retry analytics"
                      onPress={() => {
                        void analytics.refetch();
                      }}
                    />
                  </>
                ) : (
                  <>
                    {[
                      ['Total bookings', String(analytics.data.totalBookings)],
                      [
                        'Upcoming bookings',
                        String(analytics.data.upcomingBookings),
                      ],
                      [
                        'Completed bookings',
                        String(analytics.data.completedBookings),
                      ],
                      [
                        'Paid revenue',
                        businessPrice(analytics.data.paidRevenue),
                      ],
                      ['Reviews', String(analytics.data.totalReviews)],
                      [
                        'Average rating',
                        analytics.data.averageRating == null
                          ? 'No reviews yet'
                          : analytics.data.averageRating.toFixed(1),
                      ],
                      [
                        'Profile views',
                        analytics.data.profileViews == null
                          ? 'Not recorded'
                          : String(analytics.data.profileViews),
                      ],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.between}>
                        <Text
                          style={{ color: theme.colors.textSecondary, flex: 1 }}
                        >
                          {label}
                        </Text>
                        <Text
                          style={{
                            color: theme.colors.textPrimary,
                            fontWeight: '700',
                          }}
                        >
                          {value}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </WorkspaceCard>
              <Button
                title="Manage bookings"
                onPress={() =>
                  navigation.navigate('ProviderDashboard', { providerId })
                }
              />
            </>
          ) : null}
        </>
      )}
    </BusinessWorkspace>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  day: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  image: { width: '100%', height: 140, borderRadius: 15 },
  logo: { width: 80, height: 80, borderRadius: 20 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: '47%', gap: 4 },
  galleryImage: { width: '100%', height: 100, borderRadius: 12 },
});
