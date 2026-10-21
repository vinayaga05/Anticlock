import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { readCurrentPosition } from '@/features/provider-onboarding/utils/deviceLocation';
import {
  formatCoordinates,
  searchPlace,
  type MapPoint,
} from '@/features/provider-onboarding/utils/placeSearch';

const FALLBACK: MapPoint = { latitude: 13.0827, longitude: 80.2707 };
const STREET_DELTA = 0.004;

function pointFromValue(value: unknown): MapPoint | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const loc = value as Record<string, unknown>;
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

function regionFor(point: MapPoint): Region {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: STREET_DELTA,
    longitudeDelta: STREET_DELTA,
  };
}

function GoogleMap({
  center,
  interactive,
  onMove,
  style,
}: {
  center: MapPoint;
  interactive: boolean;
  onMove?: (next: MapPoint) => void;
  style?: object;
}) {
  const mapRef = useRef<MapView>(null);
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    mapRef.current?.animateToRegion(regionFor(center), 250);
  }, [center.latitude, center.longitude]);

  return (
    <View style={[styles.mapHost, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={regionFor(center)}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={region => {
          if (!interactive || !onMove) return;
          const next = {
            latitude: region.latitude,
            longitude: region.longitude,
          };
          if (
            Math.abs(next.latitude - centerRef.current.latitude) < 0.000001 &&
            Math.abs(next.longitude - centerRef.current.longitude) < 0.000001
          ) {
            return;
          }
          onMove(next);
        }}
      />
      <View pointerEvents="none" style={styles.pinWrap}>
        <AppIcon name="map-pin" size={34} color="#c2410c" />
      </View>
    </View>
  );
}

export function MapLocationField({
  value,
  addressQuery,
  onChange,
}: {
  value: unknown;
  addressQuery: string;
  onChange: (value: { latitude: string; longitude: string }) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const saved = pointFromValue(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MapPoint>(saved ?? FALLBACK);
  const [query, setQuery] = useState(addressQuery);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSearch = useRef('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setQuery(addressQuery);
  }, [addressQuery]);

  useEffect(() => {
    const trimmed = addressQuery.trim();
    if (trimmed.length < 8 || trimmed === lastSearch.current) return undefined;
    const timer = setTimeout(() => {
      void searchPlace(trimmed)
        .then(point => {
          if (!point) return;
          lastSearch.current = trimmed;
          onChangeRef.current({
            latitude: point.latitude.toFixed(6),
            longitude: point.longitude.toFixed(6),
          });
        })
        .catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [addressQuery]);

  const openMap = async () => {
    setDraft(saved ?? FALLBACK);
    setQuery(addressQuery);
    setStatus(null);
    setOpen(true);
    if (saved) return;
    setBusy(true);
    try {
      const here = await readCurrentPosition();
      setDraft(here);
      setStatus('Map is centred on you. Drag it so the pin sits on the entrance.');
    } catch {
      if (addressQuery.trim().length >= 3) {
        const found = await searchPlace(addressQuery).catch(() => null);
        if (found) {
          setDraft(found);
          setStatus('Map moved to the address. Drag the pin if it is not exact.');
          return;
        }
      }
      setStatus('Search the address, or drag the map to the business.');
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const found = await searchPlace(query);
      if (!found) {
        setStatus('No place matched that address. Drag the map instead.');
        return;
      }
      lastSearch.current = query.trim();
      setDraft(found);
      setStatus('Map moved to that address. Drag it if you need a finer point.');
    } catch {
      setStatus('Address search failed. Drag the map to the business.');
    } finally {
      setBusy(false);
    }
  };

  const useHere = async () => {
    setBusy(true);
    setStatus(null);
    try {
      setDraft(await readCurrentPosition());
      setStatus('Centred on your current location. Drag the pin if needed.');
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : 'Could not read your current location.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    onChange({
      latitude: draft.latitude.toFixed(6),
      longitude: draft.longitude.toFixed(6),
    });
    setOpen(false);
  };

  const mapWidth = Math.max(280, windowWidth - 32);
  const mapHeight = Math.max(280, windowHeight - insets.top - insets.bottom - 230);

  return (
    <View style={styles.field}>
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        Enter the address above. The pin follows that place, and you can drag it
        on the map for the exact entrance.
      </Text>
      <View
        style={[
          styles.preview,
          {
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surfaceMuted,
          },
        ]}
      >
        {saved ? (
          <GoogleMap center={saved} interactive={false} style={styles.previewMap} />
        ) : (
          <View style={styles.emptyPreview}>
            <AppIcon name="map-pin" size={22} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary }}>No pin yet</Text>
          </View>
        )}
      </View>
      <Text style={[styles.coords, { color: theme.colors.textPrimary }]}>
        {saved ? formatCoordinates(saved) : 'Open the map to choose the location'}
      </Text>
      <Button
        title={saved ? 'Adjust on map' : 'Choose on map'}
        onPress={() => void openMap()}
      />

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.background,
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Business location
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Street, area, city, pincode"
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              styles.search,
              {
                color: theme.colors.textPrimary,
                borderColor: theme.colors.borderSoft,
              },
            ]}
            onSubmitEditing={() => void search()}
            returnKeyType="search"
          />
          <View style={styles.actions}>
            <Button title="Find address" variant="secondary" onPress={() => void search()} />
            <Button title="Current location" variant="secondary" onPress={() => void useHere()} />
          </View>
          <View style={[styles.mapFrame, { width: mapWidth, height: mapHeight }]}>
            <GoogleMap
              center={draft}
              interactive
              onMove={setDraft}
              style={StyleSheet.absoluteFill}
            />
            {busy ? (
              <ActivityIndicator style={styles.busy} color={theme.colors.primary} />
            ) : null}
          </View>
          <Text style={[styles.coords, { color: theme.colors.textSecondary }]}>
            {status ?? `${formatCoordinates(draft)} · drag the map to move the pin`}
          </Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
            <Button title="Use this pin" onPress={confirm} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
  preview: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 140,
    overflow: 'hidden',
  },
  previewMap: { flex: 1 },
  emptyPreview: { alignItems: 'center', flex: 1, gap: 6, justifyContent: 'center' },
  coords: { fontSize: 12, fontWeight: '600' },
  modal: { flex: 1, gap: 10, paddingHorizontal: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  search: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  mapFrame: { borderRadius: 16, overflow: 'hidden' },
  mapHost: { backgroundColor: '#d5dde6', overflow: 'hidden' },
  busy: { position: 'absolute', right: 12, top: 12 },
  pinWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
