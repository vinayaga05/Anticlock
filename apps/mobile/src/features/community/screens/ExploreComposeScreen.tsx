import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { FilterPills } from '@/shared/components/FilterPills';
import { PostingAsCard } from '@/shared/publishing/PostingAsCard';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { resolveComposePublisher, type ComposePublisherRef } from '../composePublisher';
import { useAuth } from '@/shared/context/AuthProvider';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useCreateExploreEventMutation,
  useExploreEventQuery,
  useSubmitExploreEventMutation,
  useUpdateExploreEventMutation,
} from '@/shared/api/exploreHooks';
import {
  useCreateUserProductMutation,
  useProductCategoriesQuery,
  useProductQuery,
  useSubmitUserProductMutation,
  useUpdateUserProductMutation,
} from '@/shared/api/shopHooks';
import { useServiceCategoriesQuery } from '@/shared/api/hooks';
import { uploadContentMedia } from '@/shared/api/publishingHooks';
import {
  createCoverUploadFile,
  createVideoUploadFile,
  pickClipCover,
  pickClipVideo,
  type PickedClipCover,
  type PickedClipVideo,
} from '@/features/reels/media/clipMediaPicker';

type Props = {
  kind: 'event' | 'product';
  challengeId?: string;
  itemId?: string;
  publisherProfileId?: string;
  publisherProfileType?: 'personal' | 'business';
};
type Visibility = 'followers_only' | 'public';

const VISIBILITY = [
  { id: 'followers_only', label: 'Followers only' },
  { id: 'public', label: 'Public after approval' },
];

function tomorrowIso(hoursFromNow = 24) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

export function ExploreComposeScreen({ kind, challengeId, itemId, publisherProfileId, publisherProfileType }: Props) {
  const isEvent = kind === 'event';
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const activeProfiles = useActiveProfile();
  const [selectedPublisher, setSelectedPublisher] = useState<ComposePublisherRef | null>(
    publisherProfileId ? { id: publisherProfileId, type: publisherProfileType } : null,
  );
  const identity = resolveComposePublisher(activeProfiles.identities, activeProfiles.active, selectedPublisher);
  const eventCategories = useServiceCategoriesQuery('tours_events', []);
  const productCategories = useProductCategoriesQuery();
  const createEvent = useCreateExploreEventMutation();
  const updateEvent = useUpdateExploreEventMutation();
  const submitEvent = useSubmitExploreEventMutation();
  const createProduct = useCreateUserProductMutation();
  const updateProduct = useUpdateUserProductMutation();
  const submitProduct = useSubmitUserProductMutation();
  const existingEvent = useExploreEventQuery(isEvent ? itemId ?? '' : '');
  const existingProduct = useProductQuery(!isEvent ? itemId ?? '' : '');

  const categories = isEvent ? eventCategories.data ?? [] : productCategories.data ?? [];
  const [categoryId, setCategoryId] = useState('');
  const selectedCategoryId = categoryId || categories[0]?.id || '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('followers_only');
  const [startAt, setStartAt] = useState(tomorrowIso());
  const [endAt, setEndAt] = useState(tomorrowIso(26));
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  );
  const [venueType, setVenueType] = useState<'physical' | 'online' | 'hybrid'>('physical');
  const [location, setLocation] = useState(user?.location ?? '');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [ticketType, setTicketType] = useState<'free' | 'paid' | 'registration_required'>('free');
  const [capacity, setCapacity] = useState('20');
  const [price, setPrice] = useState('');
  const [inventory, setInventory] = useState('1');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [pickupDetails, setPickupDetails] = useState('');
  const [contactName, setContactName] = useState(user?.displayName ?? '');
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '');
  const [contactEmail, setContactEmail] = useState('');
  const [photo, setPhoto] = useState<PickedClipCover | null>(null);
  const [video, setVideo] = useState<PickedClipVideo | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [recordId, setRecordId] = useState<string | null>(itemId ?? null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const categoryPills = useMemo(
    () => categories.slice(0, 12).map(category => ({ id: category.id, label: category.name })),
    [categories],
  );
  const inputStyle = [styles.input, {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
  }];

  useEffect(() => {
    if (!itemId || hydratedId === itemId) return;
    if (isEvent && existingEvent.data) {
      const event = existingEvent.data;
      setSelectedPublisher({ id: event.publisherProfileId, type: event.publisherProfileType });
      setTitle(event.title);
      setDescription(event.description);
      setCategoryId(event.categoryId);
      setTags(event.tags.join(', '));
      setVisibility(event.requestedVisibility);
      setStartAt(event.startsAt);
      setEndAt(event.endsAt);
      setTimezone(event.timezone);
      setVenueType(event.venueType);
      setLocation(event.location?.address ?? event.location?.name ?? '');
      setOnlineUrl(event.onlineUrl ?? '');
      setTicketType(event.ticketType);
      setCapacity(String(event.capacity));
      setPrice(event.price ? String(event.price / 100) : '');
      setContactName(event.contact.name);
      setContactPhone(event.contact.phone ?? '');
      setContactEmail(event.contact.email ?? '');
      setMediaIds(event.media.map(media => media.id));
      setExistingMediaUrl(event.media[0]?.url ?? null);
      setHydratedId(itemId);
    }
    if (!isEvent && existingProduct.data) {
      const product = existingProduct.data;
      if (product.publisherProfileId) {
        setSelectedPublisher({ id: product.publisherProfileId, type: product.publisherProfileType ?? undefined });
      }
      const metadata = product.metadata ?? {};
      const delivery = Array.isArray(metadata.deliveryMethods)
        ? metadata.deliveryMethods[0]
        : 'shipping';
      const contact = typeof metadata.contact === 'object' && metadata.contact
        ? metadata.contact as { name?: string; phone?: string; email?: string }
        : {};
      setTitle(product.name);
      setDescription(product.description ?? '');
      setCategoryId(product.categoryId);
      setTags(Array.isArray(metadata.tags) ? metadata.tags.join(', ') : '');
      setVisibility(product.requestedVisibility);
      setPrice(String(product.price / 100));
      setCompareAtPrice(product.compareAtPrice ? String(product.compareAtPrice / 100) : '');
      setInventory(String(product.inventory));
      setDeliveryMethod(delivery === 'pickup' ? 'pickup' : 'shipping');
      setPickupDetails(typeof metadata.pickupDetails === 'string' ? metadata.pickupDetails : '');
      setContactName(contact.name ?? '');
      setContactPhone(contact.phone ?? '');
      setContactEmail(contact.email ?? '');
      setMediaIds(product.images.map(image => image.id));
      setExistingMediaUrl(product.images[0]?.url ?? null);
      setHydratedId(itemId);
    }
  }, [existingEvent.data, existingProduct.data, hydratedId, isEvent, itemId]);

  const selectIdentity = (id: string) => {
    const selected = activeProfiles.identities.find(item => item.id === id);
    if (selected && selected.role !== 'analyst') {
      setSelectedPublisher({ id: selected.id, type: identityProfileType(selected) });
      activeProfiles.setActive(selected);
    }
  };

  async function pickPhoto() {
    try {
      const result = await pickClipCover();
      if (result) {
        setPhoto(result);
        setMediaIds([]);
        setExistingMediaUrl(null);
      }
    } catch (error) {
      Alert.alert('Could not select image', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function pickVideo() {
    try {
      const result = await pickClipVideo();
      if (result) {
        setVideo(result);
        setMediaIds([]);
        setExistingMediaUrl(null);
      }
    } catch (error) {
      Alert.alert('Could not select video', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  function validationError() {
    if (itemId && hydratedId !== itemId) return 'Wait for your saved submission to load.';
    if (!identity) return activeProfiles.isLoading
      ? 'Wait for your publishing profiles to load.'
      : 'This publishing profile is unavailable. Choose a profile you can publish from.';
    if (!title.trim()) return `Add a ${isEvent ? 'title' : 'product name'}.`;
    if (!description.trim()) return 'Add a description.';
    if (!selectedCategoryId) return 'Choose a category.';
    if (!photo && !video && mediaIds.length === 0) return 'Add an image or video.';
    if (!contactName.trim() || (!contactPhone.trim() && !contactEmail.trim())) return 'Add public contact details.';
    if (isEvent) {
      if (!Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt))) return 'Use valid ISO date/time values.';
      if (Date.parse(endAt) <= Date.parse(startAt)) return 'End time must be after start time.';
      if (venueType !== 'online' && !location.trim()) return 'Add the event location.';
      if (venueType !== 'physical' && !onlineUrl.trim()) return 'Add the online event link.';
      if (Number(capacity) < 1) return 'Capacity must be at least 1.';
      if (ticketType === 'paid' && Number(price) <= 0) return 'Add a valid paid ticket price.';
    } else {
      if (Number(price) <= 0) return 'Add a valid product price.';
      if (Number(inventory) < 0) return 'Stock cannot be negative.';
      if (deliveryMethod === 'pickup' && !pickupDetails.trim()) return 'Add pickup details.';
    }
    return null;
  }

  async function ensureUploads() {
    if (mediaIds.length) return mediaIds;
    if (!identity) throw new Error('Publishing profile unavailable.');
    const files = [
      ...(photo ? [await createCoverUploadFile(photo)] : []),
      ...(video ? [await createVideoUploadFile(video)] : []),
    ];
    const ids: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      ids.push(await uploadContentMedia(identity, files[index]!, 'followers', undefined, {
        onProgress: fraction => setProgress(Math.round(((index + fraction) / files.length) * 70)),
      }));
    }
    setMediaIds(ids);
    return ids;
  }

  async function persist(shouldSubmit: boolean) {
    const error = validationError();
    if (error) {
      Alert.alert('Check your submission', error);
      return;
    }
    if (!identity) return;
    setSelectedPublisher({ id: identity.id, type: identityProfileType(identity) });
    setBusy(true);
    try {
      const uploaded = await ensureUploads();
      setProgress(80);
      const tagValues = [...new Set(tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean))];
      let savedId = recordId;
      if (isEvent) {
        const input = {
          title: title.trim(),
          description: description.trim(),
          categoryId: selectedCategoryId,
          tags: tagValues,
          startsAt: new Date(startAt).toISOString(),
          endsAt: new Date(endAt).toISOString(),
          timezone: timezone.trim(),
          venueType,
          location: venueType === 'online' ? null : { name: location.trim(), address: location.trim() },
          onlineUrl: venueType === 'physical' ? null : onlineUrl.trim(),
          ticketType,
          capacity: Number(capacity),
          price: ticketType === 'paid' ? Math.round(Number(price) * 100) : 0,
          currency: 'INR',
          contact: {
            name: contactName.trim(),
            ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
            ...(contactPhone.trim() ? { phone: contactPhone.trim() } : {}),
          },
          requestedVisibility: visibility,
          mediaIds: uploaded,
          ...(challengeId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId)
            ? { challengeId }
            : {}),
        } as const;
        if (savedId) {
          await updateEvent.mutateAsync({ id: savedId, update: input });
        } else {
          const saved = await createEvent.mutateAsync({
            ...input,
            publisherProfileId: identity.id,
            publisherProfileType: identityProfileType(identity),
          });
          savedId = saved.id;
          setRecordId(saved.id);
        }
        if (shouldSubmit) await submitEvent.mutateAsync(savedId!);
      } else {
        const deliveryMethods: Array<'shipping' | 'pickup'> = [deliveryMethod];
        const input = {
          categoryId: selectedCategoryId,
          name: title.trim(),
          description: description.trim(),
          price: Math.round(Number(price) * 100),
          compareAtPrice: compareAtPrice.trim() ? Math.round(Number(compareAtPrice) * 100) : null,
          inventory: Number(inventory),
          imageIds: uploaded,
          tags: tagValues,
          requestedVisibility: visibility,
          deliveryMethods,
          pickupDetails: deliveryMethod === 'pickup' ? pickupDetails.trim() : null,
          contact: {
            name: contactName.trim(),
            ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
            ...(contactPhone.trim() ? { phone: contactPhone.trim() } : {}),
          },
        };
        if (savedId) {
          await updateProduct.mutateAsync({ id: savedId, update: input });
        } else {
          const saved = await createProduct.mutateAsync({
            ...input,
            publisherProfileId: identity.id,
            publisherProfileType: identityProfileType(identity),
          });
          savedId = saved.id;
          setRecordId(saved.id);
        }
        if (shouldSubmit) await submitProduct.mutateAsync(savedId!);
      }
      setProgress(100);
      Alert.alert(
        shouldSubmit ? 'Submitted for review' : 'Draft saved',
        shouldSubmit
          ? `${title.trim()} is stored in Anticlock and waiting for Admin review.`
          : `Draft ${savedId} is stored in Anticlock.`,
        shouldSubmit ? [{ text: 'Done', onPress: () => navigation.popToTop() }] : undefined,
      );
    } catch (caught) {
      Alert.alert('Could not save', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title={isEvent ? 'Create Event' : 'Add Product'} showBrand={false} showActions={false} />
      <PostingAsCard
        identities={activeProfiles.identities.filter(item => item.role !== 'analyst')}
        identity={identity}
        onSelect={selectIdentity}
        isLoading={activeProfiles.isLoading}
        fallbackApplied={selectedPublisher ? !identity && !activeProfiles.isLoading : activeProfiles.fallbackApplied}
        disabled={busy || Boolean(recordId)}
      />
      {selectedPublisher && !identity && !activeProfiles.isLoading ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
          This publishing profile is unavailable. Go back or choose an available profile before continuing.
        </Text>
      ) : null}
      <FilterPills pills={VISIBILITY} activeId={visibility} onChange={id => setVisibility(id as Visibility)} />
      <Card style={{ gap: 12 }}>
        <Field label={isEvent ? 'Event title' : 'Product name'}>
          <TextInput value={title} onChangeText={setTitle} style={inputStyle} placeholder={isEvent ? 'Weekend Cycling Meetup' : 'Resistance Band Set'} placeholderTextColor={theme.colors.textTertiary} />
        </Field>
        <Field label="Description">
          <TextInput value={description} onChangeText={setDescription} style={[inputStyle, styles.multiline]} multiline placeholder="Tell people what to expect" placeholderTextColor={theme.colors.textTertiary} />
        </Field>
        <Field label="Category">
          {categoryPills.length ? <FilterPills pills={categoryPills} activeId={selectedCategoryId} onChange={setCategoryId} /> : <Text style={{ color: theme.colors.error }}>No active categories are available.</Text>}
        </Field>
        <Field label="Tags (comma separated)">
          <TextInput value={tags} onChangeText={setTags} style={inputStyle} placeholder="fitness, chennai" placeholderTextColor={theme.colors.textTertiary} />
        </Field>
        <Field label="Media">
          <View style={styles.actionRow}>
            <Button title={photo ? 'Replace image' : 'Add image'} variant="secondary" onPress={() => void pickPhoto()} disabled={busy} />
            <Button title={video ? 'Replace video' : 'Add video'} variant="secondary" onPress={() => void pickVideo()} disabled={busy} />
          </View>
          {photo ? <Image source={{ uri: String(photo.previewSource) }} style={styles.preview} /> : null}
          {!photo && existingMediaUrl ? <Image source={{ uri: existingMediaUrl }} style={styles.preview} /> : null}
          {video ? <Text style={{ color: theme.colors.textSecondary }}>Video: {video.filename}</Text> : null}
        </Field>
        {isEvent ? (
          <>
            <Field label="Start (ISO date/time)"><TextInput value={startAt} onChangeText={setStartAt} style={inputStyle} autoCapitalize="none" /></Field>
            <Field label="End (ISO date/time)"><TextInput value={endAt} onChangeText={setEndAt} style={inputStyle} autoCapitalize="none" /></Field>
            <Field label="Timezone"><TextInput value={timezone} onChangeText={setTimezone} style={inputStyle} autoCapitalize="none" /></Field>
            <Field label="Venue"><FilterPills pills={[{ id: 'physical', label: 'Physical' }, { id: 'online', label: 'Online' }, { id: 'hybrid', label: 'Hybrid' }]} activeId={venueType} onChange={id => setVenueType(id as typeof venueType)} /></Field>
            {venueType !== 'online' ? <Field label="Location"><TextInput value={location} onChangeText={setLocation} style={inputStyle} placeholder="Venue and address" placeholderTextColor={theme.colors.textTertiary} /></Field> : null}
            {venueType !== 'physical' ? <Field label="Online link"><TextInput value={onlineUrl} onChangeText={setOnlineUrl} style={inputStyle} autoCapitalize="none" placeholder="https://…" placeholderTextColor={theme.colors.textTertiary} /></Field> : null}
            <Field label="Ticket type"><FilterPills pills={[{ id: 'free', label: 'Free' }, { id: 'paid', label: 'Paid' }, { id: 'registration_required', label: 'Registration' }]} activeId={ticketType} onChange={id => setTicketType(id as typeof ticketType)} /></Field>
            <Field label="Capacity"><TextInput value={capacity} onChangeText={setCapacity} style={inputStyle} keyboardType="number-pad" /></Field>
            {ticketType === 'paid' ? <Field label="Price (₹)"><TextInput value={price} onChangeText={setPrice} style={inputStyle} keyboardType="decimal-pad" /></Field> : null}
          </>
        ) : (
          <>
            <Field label="Price (₹)"><TextInput value={price} onChangeText={setPrice} style={inputStyle} keyboardType="decimal-pad" /></Field>
            <Field label="Compare-at price (₹, optional)"><TextInput value={compareAtPrice} onChangeText={setCompareAtPrice} style={inputStyle} keyboardType="decimal-pad" /></Field>
            <Field label="Stock quantity"><TextInput value={inventory} onChangeText={setInventory} style={inputStyle} keyboardType="number-pad" /></Field>
            <Field label="Delivery"><FilterPills pills={[{ id: 'shipping', label: 'Shipping' }, { id: 'pickup', label: 'Pickup' }]} activeId={deliveryMethod} onChange={id => setDeliveryMethod(id as typeof deliveryMethod)} /></Field>
            {deliveryMethod === 'pickup' ? <Field label="Pickup details"><TextInput value={pickupDetails} onChangeText={setPickupDetails} style={inputStyle} /></Field> : null}
          </>
        )}
        <Field label="Public contact name"><TextInput value={contactName} onChangeText={setContactName} style={inputStyle} /></Field>
        <Field label="Public contact phone"><TextInput value={contactPhone} onChangeText={setContactPhone} style={inputStyle} keyboardType="phone-pad" /></Field>
        <Field label="Public contact email (optional)"><TextInput value={contactEmail} onChangeText={setContactEmail} style={inputStyle} keyboardType="email-address" autoCapitalize="none" /></Field>
      </Card>
      {busy ? <Text style={{ color: theme.colors.primary }}>Uploading and saving… {progress}%</Text> : null}
      <View style={styles.actions}>
        <Button title="Save Draft" variant="secondary" onPress={() => void persist(false)} disabled={busy} />
        <Button title="Submit for Review" icon="send" onPress={() => void persist(true)} disabled={busy} />
      </View>
    </ScreenContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={{ gap: 6 }}><Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{label}</Text>{children}</View>;
}

export function CreateExploreEventScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateExploreEvent'>>();
  return <ExploreComposeScreen
    kind="event"
    challengeId={route.params?.challengeId}
    itemId={route.params?.itemId}
    publisherProfileId={route.params?.publisherProfileId}
    publisherProfileType={route.params?.publisherProfileType}
  />;
}

export function CreateExploreProductScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateExploreProduct'>>();
  return <ExploreComposeScreen
    kind="product"
    itemId={route.params?.itemId}
    publisherProfileId={route.params?.publisherProfileId}
    publisherProfileType={route.params?.publisherProfileType}
  />;
}

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  actions: { gap: 10, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  preview: { width: '100%', height: 180, borderRadius: 12 },
});
