import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CreateBusinessReviewRequest } from '@anticlock/contracts';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  pickProfilePhoto,
  type PickedProfilePhoto,
} from '@/features/profile/utils/profilePhoto';
import type { PublishingIdentity } from '@/shared/api/publishingHooks';
import { getApiToken } from '@/shared/api/client';
import { uploadBusinessImage } from '../businessMedia';
import type { BusinessBrand } from '../businessProfileModel';

type PhotoDraft = { photo: PickedProfilePhoto; mediaId?: string };
type Props = {
  providerId?: string;
  visible: boolean;
  brand: BusinessBrand;
  bookings: { id: string; serviceTitle: string; startsAt: string }[];
  identity: PublishingIdentity | null;
  onClose: () => void;
  onSubmit: (review: CreateBusinessReviewRequest) => Promise<unknown>;
};
export function BusinessReviewComposer({
  providerId = '',
  visible,
  brand,
  bookings,
  identity,
  onClose,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const picking = useRef<object | null>(null);
  const [selecting, setSelecting] = useState(false);
  const token = getApiToken();
  const context = JSON.stringify([
    providerId,
    identity?.type,
    identity?.id,
    token,
  ]);
  const contextRef = useRef({ key: context, visible });
  contextRef.current = { key: context, visible };
  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;
  const selectedBookingId = bookings.some(booking => booking.id === bookingId)
    ? bookingId
    : bookings[0]?.id;
  const blocked = busy || selecting;
  const canEdit = () => !operation.current && !picking.current;
  const sameContext = (key: string) =>
    mounted.current &&
    contextRef.current.key === key &&
    contextRef.current.visible;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
      operation.current = null;
      picking.current = null;
    };
  }, []);
  useEffect(() => {
    operation.current?.abort();
    operation.current = null;
    picking.current = null;
    setSelecting(false);
    setPhotos([]);
    setBody('');
    setRating(5);
    setBookingId(null);
    setError(null);
    setBusy(false);
  }, [context]);
  useEffect(() => {
    if (!visible) {
      operation.current?.abort();
      operation.current = null;
      picking.current = null;
      setBusy(false);
      setSelecting(false);
    }
  }, [visible]);
  const close = () => {
    if (canEdit()) onClose();
  };
  const addPhoto = async () => {
    if (!visible || !identity || !canEdit() || photos.length >= 4) return;
    const key = context;
    const request = {};
    picking.current = request;
    setSelecting(true);
    setError(null);
    try {
      const photo = await pickProfilePhoto('library');
      if (sameContext(key) && picking.current === request && photo)
        setPhotos(current => [...current, { photo }].slice(0, 4));
    } catch (problem) {
      if (sameContext(key) && picking.current === request)
        setError(
          problem instanceof Error
            ? problem.message
            : 'Could not open your photos.',
        );
    } finally {
      if (mounted.current && picking.current === request) {
        picking.current = null;
        setSelecting(false);
      }
    }
  };
  const submit = async () => {
    if (!visible || !canEdit() || !identity) return;
    const selected = bookings.find(booking => booking.id === selectedBookingId);
    if (!selected || body.trim().length < 10 || body.trim().length > 2000) {
      setError(
        selected
          ? 'Write 10 to 2,000 characters about your experience.'
          : 'A completed booking is needed to write a verified review.',
      );
      return;
    }
    const request = new AbortController();
    const key = context;
    operation.current = request;
    setBusy(true);
    setError(null);
    const current = () =>
      sameContext(key) &&
      operation.current === request &&
      getApiToken() === token &&
      !request.signal.aborted;
    try {
      const mediaIds: string[] = [];
      for (let index = 0; index < photos.length; index += 1) {
        const draft = photos[index];
        const id =
          draft.mediaId ??
          (await uploadBusinessImage(identity, draft.photo, request.signal));
        if (!current()) return;
        mediaIds.push(id);
        setPhotos(previous =>
          previous.map((item, offset) =>
            offset === index ? { ...item, mediaId: id } : item,
          ),
        );
      }
      if (!current()) return;
      if (!bookingsRef.current.some(booking => booking.id === selected.id))
        throw new Error(
          'That booking is no longer available to review. Choose another completed booking.',
        );
      await onSubmit({
        bookingId: selected.id,
        rating,
        body: body.trim(),
        photoMediaIds: mediaIds,
      });
      if (!current()) return;
      setBody('');
      setPhotos([]);
      setRating(5);
      setBookingId(null);
      onClose();
    } catch (problem) {
      if (current())
        setError(
          problem instanceof Error
            ? problem.message
            : 'Your review could not be saved. Try again.',
        );
    } finally {
      if (mounted.current && operation.current === request) {
        operation.current = null;
        setBusy(false);
      }
    }
  };
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.root, { backgroundColor: theme.colors.background }]}
      >
        <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Your experience
          </Text>
          <PressableScale
            disabled={blocked}
            accessibilityLabel="Close review"
            onPress={close}
            style={styles.close}
          >
            <AppIcon name="close" size={22} color={theme.colors.textPrimary} />
          </PressableScale>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 21 }}>
            Share a first-hand review from a completed booking. Photos help
            others choose with confidence.
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(value => (
              <PressableScale
                key={value}
                disabled={blocked}
                accessibilityLabel={`Rate ${value} out of 5`}
                accessibilityState={{ selected: rating === value }}
                onPress={() => {
                  if (canEdit()) setRating(value);
                }}
                style={styles.star}
              >
                <AppIcon
                  name="star"
                  size={30}
                  color={
                    value <= rating ? brand.accent : theme.colors.textTertiary
                  }
                  fill={value <= rating ? brand.accent : 'transparent'}
                />
              </PressableScale>
            ))}
          </View>
          {bookings.length ? (
            <View style={styles.bookings}>
              {bookings.map(booking => (
                <PressableScale
                  key={booking.id}
                  disabled={blocked}
                  onPress={() => {
                    if (canEdit()) setBookingId(booking.id);
                  }}
                  accessibilityLabel={`Review ${booking.serviceTitle}`}
                  accessibilityState={{
                    selected: selectedBookingId === booking.id,
                  }}
                  style={[
                    styles.booking,
                    {
                      borderColor:
                        selectedBookingId === booking.id
                          ? brand.accent
                          : theme.colors.borderSoft,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.colors.textPrimary,
                      fontWeight: '600',
                    }}
                  >
                    {booking.serviceTitle}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {new Date(booking.startsAt).toLocaleDateString('en-IN')}
                  </Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
          <TextInput
            accessibilityLabel="Your review"
            editable={!blocked}
            multiline
            maxLength={2000}
            value={body}
            onChangeText={value => {
              if (canEdit()) setBody(value);
            }}
            placeholder="What stood out about your visit?"
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderSoft,
              },
            ]}
          />
          <Text
            style={{
              textAlign: 'right',
              color: theme.colors.textTertiary,
              fontSize: 11,
            }}
          >
            {body.length}/2000
          </Text>
          <View style={styles.photos}>
            {photos.map((draft, index) => (
              <PressableScale
                key={`${draft.photo.uri}-${index}`}
                disabled={blocked}
                accessibilityLabel={`Remove review photo ${index + 1}`}
                onPress={() => {
                  if (canEdit())
                    setPhotos(current =>
                      current.filter((_, offset) => offset !== index),
                    );
                }}
              >
                <Image source={{ uri: draft.photo.uri }} style={styles.photo} />
                <View style={styles.photoRemove}>
                  <AppIcon name="close" size={13} color="#FFFFFF" />
                </View>
              </PressableScale>
            ))}
            {photos.length < 4 ? (
              <PressableScale
                disabled={blocked}
                accessibilityLabel="Add review photo"
                onPress={() => void addPhoto()}
                style={[
                  styles.addPhoto,
                  { borderColor: theme.colors.borderSoft },
                ]}
              >
                <AppIcon name="camera" size={24} color={brand.accent} />
                <Text style={{ color: brand.accent, fontSize: 11 }}>
                  Add photo
                </Text>
              </PressableScale>
            ) : null}
          </View>
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: theme.colors.error, lineHeight: 20 }}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View
          style={[
            styles.bottom,
            {
              paddingBottom: insets.bottom + 16,
              borderColor: theme.colors.borderSoft,
            },
          ]}
        >
          <PressableScale
            disabled={blocked || !bookings.length || !identity}
            accessibilityLabel="Post verified review"
            onPress={() => void submit()}
            style={[
              styles.submit,
              {
                backgroundColor: brand.button,
                opacity: !bookings.length ? 0.5 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppIcon name="check" color="#FFFFFF" size={18} />
            )}
            <Text style={styles.submitText}>
              {busy ? 'Posting review…' : 'Post review'}
            </Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 24, gap: 16 },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  star: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookings: { gap: 8 },
  booking: { padding: 14, borderRadius: 16, borderWidth: 1 },
  input: {
    padding: 16,
    minHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    fontSize: 15,
    textAlignVertical: 'top',
    lineHeight: 23,
  },
  photos: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photo: { width: 64, height: 74, borderRadius: 12 },
  photoRemove: {
    position: 'absolute',
    right: 3,
    top: 3,
    backgroundColor: '#00000090',
    padding: 3,
    borderRadius: 10,
  },
  addPhoto: {
    width: 72,
    height: 74,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    borderRadius: 18,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
