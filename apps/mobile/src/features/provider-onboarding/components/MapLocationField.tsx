import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { readCurrentPosition } from '../utils/deviceLocation';
import { parseLocationValue } from '../utils/formValues';
import { formatCoordinates, reversePlace, searchPlaces, type BusinessPlace, type MapPoint } from '../utils/placeSearch';

const FALLBACK: MapPoint = { latitude: 13.0827, longitude: 80.2707 };
const regionFor = (point: MapPoint): Region => ({ ...point, latitudeDelta: 0.004, longitudeDelta: 0.004 });
export type ConfirmedBusinessLocation = { latitude: string; longitude: string; pinConfirmed: true; address: string; city?: string; area?: string; pincode?: string };

function EntranceMap({ center, onMove, onLoaded, onFailure }: { center: MapPoint; onMove: (point: MapPoint) => void; onLoaded: () => void; onFailure: () => void }) {
  const map = useRef<MapView>(null);
  const callbacks = useRef({ onLoaded, onFailure }); callbacks.current = { onLoaded, onFailure };
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    timeout.current = setTimeout(() => callbacks.current.onFailure(), 15_000);
    return () => clearTimeout(timeout.current);
  }, []);
  useEffect(() => { map.current?.animateToRegion(regionFor(center), 250); }, [center.latitude, center.longitude]);
  return <View style={{ flex: 1 }}>
    <MapView ref={map} accessibilityLabel="Business entrance map" provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} initialRegion={regionFor(center)} rotateEnabled={false} pitchEnabled={false}
      onMapLoaded={() => { clearTimeout(timeout.current); callbacks.current.onLoaded(); }}
      onPress={event => onMove(event.nativeEvent.coordinate)}
      onRegionChangeComplete={(region, details) => { if (details?.isGesture) onMove({ latitude: region.latitude, longitude: region.longitude }); }} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 34 }}>📍</Text></View>
  </View>;
}

export function MapLocationField({ value, addressQuery, addressParts, onChange }: { value: unknown; addressQuery: string; addressParts?: { address?: string; city?: string; area?: string; pincode?: string }; onChange: (value: ConfirmedBusinessLocation | null) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const saved = parseLocationValue(value);
  const confirmed = Boolean(saved && (value as { pinConfirmed?: boolean })?.pinConfirmed === true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MapPoint>(saved ?? FALLBACK);
  const [selected, setSelected] = useState(false);
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState('');
  const [details, setDetails] = useState<Partial<BusinessPlace>>({});
  const [results, setResults] = useState<BusinessPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<'search' | 'reverse' | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [moveVersion, setMoveVersion] = useState(0);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const close = () => { generation.current++; setBusy(false); setOpen(false); };
  const openMap = () => {
    generation.current++; setDraft(saved ?? FALLBACK); setSelected(Boolean(saved)); setAddress(saved ? addressParts?.address ?? addressQuery : '');
    setDetails(saved ? addressParts ?? {} : {}); setQuery(addressQuery); setResults([]); setStatus(null); setRetryAction(null); setBusy(false);
    setMoveVersion(0); setMapLoaded(false); setMapFailed(false); setMapVersion(version => version + 1); setOpen(true);
  };
  const selectPlace = (place: BusinessPlace) => {
    generation.current++; setMoveVersion(0); setDraft(place); setSelected(true); setAddress(place.address); setDetails(place); setResults([]); setBusy(false); setStatus('Move the pin to the exact entrance, then confirm.'); setRetryAction(null);
  };
  const move = (point: MapPoint) => {
    if (!parseLocationValue(point)) return;
    generation.current++; setDraft(point); setSelected(true); setAddress(''); setDetails({}); setResults([]); setMoveVersion(version => version + 1);
  };
  const reverse = async (point: MapPoint) => {
    const id = ++generation.current; setBusy(true); setRetryAction(null);
    try {
      const found = await reversePlace(point);
      if (id !== generation.current) return;
      setAddress(found?.address ?? ''); setDetails(found ?? {});
      setStatus(found ? 'Check the suggested address and confirm the entrance.' : 'No suggested address. Enter the address below, then confirm.');
    } catch {
      if (id === generation.current) { setStatus('Couldn’t find the address. Retry, or enter it below without moving the pin.'); setRetryAction('reverse'); }
    } finally { if (id === generation.current) setBusy(false); }
  };
  useEffect(() => {
    if (!open || !moveVersion) return;
    const timer = setTimeout(() => { void reverse(draft); }, 400);
    return () => clearTimeout(timer);
    // A geocode result moves the map without triggering another reverse lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveVersion, open]);
  const search = async () => {
    const id = ++generation.current; setBusy(true); setStatus(null); setRetryAction(null);
    try {
      const found = await searchPlaces(query);
      if (id !== generation.current) return;
      setResults(found); setStatus(found.length ? 'Select an address below.' : 'No matching address. Try another search or move the pin manually.');
    } catch { if (id === generation.current) { setStatus('Address search failed. Retry or move the pin manually.'); setRetryAction('search'); } }
    finally { if (id === generation.current) setBusy(false); }
  };
  const useHere = async () => {
    const id = ++generation.current; setBusy(true); setStatus(null);
    try { const point = await readCurrentPosition(); if (id === generation.current) move(point); }
    catch (error) { if (id === generation.current) setStatus(error instanceof Error ? error.message : 'GPS is unavailable. Search or move the pin manually.'); }
    finally { if (id === generation.current) setBusy(false); }
  };
  const confirm = () => {
    if (!selected || !mapLoaded || busy || !address.trim()) return;
    onChange({ latitude: draft.latitude.toFixed(6), longitude: draft.longitude.toFixed(6), pinConfirmed: true, address: address.trim(), city: details.city ?? '', area: details.area ?? '', pincode: details.pincode ?? '' }); close();
  };
  const inputStyle = { color: colors.textPrimary, borderColor: colors.borderSoft, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 };
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.textSecondary }}>{confirmed ? 'Confirmed entrance' : saved ? 'Saved pin — confirm it before submitting' : 'No confirmed location'}</Text>
    {saved ? <Text style={{ color: colors.textPrimary }}>{formatCoordinates(saved)}</Text> : null}
    <Button title={saved ? 'Adjust on map' : 'Choose on map'} onPress={openMap} />
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      {open ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 12, backgroundColor: colors.background, flexGrow: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>Business Location</Text>
        <TextInput accessibilityLabel="Search business address" value={query} onChangeText={text => { generation.current++; setQuery(text); setBusy(false); setResults([]); }} placeholder="Street, area, city or pincode" placeholderTextColor={colors.textTertiary} style={inputStyle} onSubmitEditing={() => void search()} returnKeyType="search" />
        <Button title="Find address" onPress={() => void search()} disabled={busy || query.trim().length < 3} />
        {results.map((place, index) => <Button key={`${place.latitude}-${place.longitude}-${index}`} title={place.address} variant="secondary" onPress={() => selectPlace(place)} />)}
        <Button title="Use my current location" variant="secondary" disabled={busy} onPress={() => void useHere()} />
        <View style={{ height: Math.max(230, Math.min(360, height * 0.4)), borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceMuted }}>
          <EntranceMap key={mapVersion} center={draft} onMove={move} onLoaded={() => { setMapLoaded(true); setMapFailed(false); }} onFailure={() => { setMapLoaded(false); setMapFailed(true); }} />
          {busy ? <ActivityIndicator style={{ position: 'absolute', top: 12, right: 12 }} color={colors.primary} /> : null}
        </View>
        {mapFailed ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: colors.error }}>The map couldn’t load. Your location draft is still here.</Text><Button title="Retry map" onPress={() => { setMapFailed(false); setMapLoaded(false); setMapVersion(version => version + 1); }} /></View> : null}
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{status ?? 'Tap or drag the map to put the pin on your business entrance.'}</Text>
        {retryAction ? <Button title="Retry" variant="secondary" onPress={() => void (retryAction === 'search' ? search() : reverse(draft))} disabled={busy} /> : null}
        <Text style={{ color: colors.textSecondary }}>{selected ? formatCoordinates(draft) : 'Choose a location before confirming. The default map position is not saved.'}</Text>
        <TextInput accessibilityLabel="Suggested business address" value={address} onChangeText={text => { generation.current++; setBusy(false); setAddress(text); }} placeholder="Confirm or correct the suggested address" placeholderTextColor={colors.textTertiary} style={inputStyle} multiline />
        <Text style={{ color: colors.textSecondary }}>Add shop number, floor or landmark in the form after confirming. Those details keep this pin in place.</Text>
        <Button title="Confirm location" onPress={confirm} disabled={!selected || !mapLoaded || busy || !address.trim()} />
        <Button title="Cancel" variant="ghost" onPress={close} />
      </ScrollView> : null}
    </Modal>
  </View>;
}
