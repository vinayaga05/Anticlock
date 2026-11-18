import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { Button } from '@/shared/components/Button';
import {
  pickProfilePhoto,
  uploadProfilePhoto,
} from '@/features/profile/utils/profilePhoto';
import { useTheme } from '@/shared/hooks/useTheme';

type Photos = { logoUrl?: string; coverUrl?: string };
export function TeamPhotosEditor({
  photos,
  onChange,
  onBusyChange,
  showPreviews = true,
}: {
  photos: Photos;
  onChange: (photos: Photos) => void;
  onBusyChange?: (busy: boolean) => void;
  showPreviews?: boolean;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const choose = async (key: keyof Photos) => {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const photo = await pickProfilePhoto('library');
      if (!photo || controller.signal.aborted) return;
      const url = await uploadProfilePhoto(photo, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) onChange({ [key]: url });
    } catch (error) {
      if (!controller.signal.aborted)
        Alert.alert(
          'Photo could not be saved',
          error instanceof Error ? error.message : 'Please try again.',
        );
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };
  return (
    <View style={{ gap: 12 }}>
      {(['logoUrl', 'coverUrl'] as const).map(key => (
        <View key={key} style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textPrimary }}>
            {key === 'logoUrl' ? 'Team profile photo' : 'Team cover photo'}
          </Text>
          {showPreviews && photos[key] ? (
            <Image
              source={{ uri: photos[key] }}
              style={{
                width: key === 'logoUrl' ? 80 : '100%',
                height: key === 'logoUrl' ? 80 : 140,
                borderRadius: key === 'logoUrl' ? 40 : 12,
              }}
            />
          ) : null}
          <Button
            title={`${photos[key] ? 'Edit' : 'Add'} ${
              key === 'logoUrl' ? 'team profile photo' : 'team cover photo'
            }`}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void choose(key);
            }}
          />
        </View>
      ))}
      {busy ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: theme.colors.textSecondary }}
        >
          Saving photo…
        </Text>
      ) : null}
    </View>
  );
}
