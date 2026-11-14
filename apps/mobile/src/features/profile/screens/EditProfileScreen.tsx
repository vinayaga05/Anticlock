import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useAuth } from '@/shared/context/AuthProvider';
import { getApiToken } from '@/shared/api/client';
import { useTheme } from '@/shared/hooks/useTheme';
import { pickProfilePhoto, uploadProfilePhoto, type PickedProfilePhoto } from '../utils/profilePhoto';
import { profileDraft, profileInitials, storedProfilePhoto, validateProfileDraft, type ProfileDraft } from '../profileForm';

type Palette = ReturnType<typeof profilePalette>;
function profilePalette(dark: boolean) {
  return dark ? {
    background: '#101018', card: '#1C1C29', field: '#242433', border: '#343342', ink: '#F5F2FC', muted: '#B6B2C9',
    violet: '#B7A5FF', action: '#7661DD', hero: '#242039', champagne: '#E5D2A6', error: '#FFB4BE', errorBg: '#3D202C',
  } : {
    background: '#F5F3EF', card: '#FFFFFF', field: '#F8F7FB', border: '#E7E4ED', ink: '#202034', muted: '#726D83',
    violet: '#6956C9', action: '#6956C9', hero: '#202036', champagne: '#E2D0A6', error: '#A32C45', errorBg: '#FBECEF',
  };
}

type FieldProps = { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; maxLength: number; palette: Palette; disabled: boolean; multiline?: boolean; url?: boolean; icon?: IconName };
function ProfileField({ label, value, onChangeText, placeholder, maxLength, palette, disabled, multiline, url, icon }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
        {multiline ? <Text style={[styles.counter, { color: palette.muted }]}>{value.length}/{maxLength}</Text> : null}
      </View>
      <View style={[styles.inputWrap, { backgroundColor: palette.field, borderColor: palette.border }, multiline && styles.multilineWrap]}>
        {icon ? <AppIcon name={icon} size={18} color={palette.muted} /> : null}
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={!disabled} placeholder={placeholder} placeholderTextColor={palette.muted} maxLength={maxLength} multiline={multiline} keyboardType={url ? 'url' : 'default'} autoCapitalize={url ? 'none' : 'sentences'} autoCorrect={!url} style={[styles.input, { color: palette.ink }, multiline && styles.bioInput]} />
      </View>
    </View>
  );
}

export function EditProfileScreen() {
  const theme = useTheme();
  const palette = profilePalette(theme.mode === 'dark');
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout } = useAuth();
  const [draft, setDraft] = useState(() => profileDraft(user));
  const [baseline, setBaseline] = useState(() => profileDraft(user));
  const [basePhoto, setBasePhoto] = useState(() => storedProfilePhoto(user?.avatarUrl));
  const [photo, setPhoto] = useState<PickedProfilePhoto | null>(null);
  const [removed, setRemoved] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<'uploading' | 'saving'>('saving');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ message: string; settings?: boolean } | null>(null);
  const mounted = useRef(true);
  const userRef = useRef(user); userRef.current = user;
  const picker = useRef<object | null>(null);
  const operation = useRef<{ controller: AbortController } | null>(null);
  const uploadCache = useRef<{ photo: PickedProfilePhoto; url: string; ownerId: string } | null>(null);
  const signedIn = Boolean(user && user.id !== 'temporary-guest');
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || Boolean(photo) || (removed && Boolean(basePhoto));
  const busy = saving || selecting;
  const previewUri = photo?.uri ?? (removed ? null : basePhoto);
  const initials = useMemo(() => profileInitials(draft.displayName), [draft.displayName]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current?.controller.abort(); picker.current = null; };
  }, []);
  useEffect(() => {
    operation.current?.controller.abort(); operation.current = null; picker.current = null; uploadCache.current = null;
    const initial = profileDraft(userRef.current);
    setDraft(initial); setBaseline(initial); setBasePhoto(storedProfilePhoto(userRef.current?.avatarUrl));
    setPhoto(null); setRemoved(false); setSaving(false); setSelecting(false); setSaved(false); setError(null);
  }, [user?.id]);
  useEffect(() => { setPreviewFailed(false); }, [previewUri]);

  usePreventRemove(busy || dirty, ({ data }) => {
    if (busy || operation.current || picker.current) return;
    Alert.alert('Discard changes?', 'Your changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const edit = (field: keyof ProfileDraft, value: string) => { if (operation.current || picker.current) return; setDraft(current => ({ ...current, [field]: value })); setSaved(false); setError(null); };
  const choosePhoto = async (source: 'camera' | 'library') => {
    if (picker.current || operation.current || !signedIn) return;
    const ownerId = user?.id; const expectedToken = getApiToken(); const request = {};
    picker.current = request; setSelecting(true); setError(null);
    try {
      const selected = await pickProfilePhoto(source);
      if (!mounted.current || picker.current !== request || userRef.current?.id !== ownerId || getApiToken() !== expectedToken) return;
      if (selected) { setPhoto(selected); setRemoved(false); setSaved(false); uploadCache.current = null; }
    } catch (problem) {
      if (mounted.current && picker.current === request && userRef.current?.id === ownerId) {
        const failure = problem as { message?: string; code?: string };
        if (!['cancelled', 'session_changed'].includes(failure.code ?? '')) setError({ message: failure.message || 'Could not open your photos. Please try again.', settings: failure.code === 'permission_denied' });
      }
    } finally {
      if (mounted.current && picker.current === request) { picker.current = null; setSelecting(false); }
    }
  };
  const removePhoto = () => { if (busy || operation.current || picker.current) return; setPhoto(null); setRemoved(true); uploadCache.current = null; setSaved(false); setError(null); };

  const save = async () => {
    if (operation.current || picker.current || !signedIn || !dirty) return;
    let fields;
    try { fields = validateProfileDraft(draft); }
    catch (problem) { setError({ message: problem instanceof Error ? problem.message : 'Check your profile details.' }); return; }
    const ownerId = user?.id;
    if (!ownerId) return;
    const expectedToken = getApiToken();
    const request = { controller: new AbortController() };
    const isCurrentSession = () => mounted.current && operation.current === request && userRef.current?.id === ownerId && getApiToken() === expectedToken && !request.controller.signal.aborted;
    operation.current = request; setSaving(true); setError(null); setSaved(false);
    try {
      let avatarUrl = removed ? null : basePhoto;
      if (photo) {
        if (uploadCache.current?.photo === photo && uploadCache.current.ownerId === ownerId) avatarUrl = uploadCache.current.url;
        else {
          setPhase('uploading');
          avatarUrl = await uploadProfilePhoto(photo, { signal: request.controller.signal, expectedUserId: ownerId, expectedToken, isCurrentSession });
          if (!isCurrentSession()) return;
          uploadCache.current = { photo, url: avatarUrl, ownerId };
        }
      }
      if (!isCurrentSession()) return;
      setPhase('saving');
      await updateProfile({ ...fields, avatarUrl });
      if (!isCurrentSession()) return;
      const next = { displayName: fields.displayName, bio: fields.bio ?? '', location: fields.location ?? '', website: fields.website ?? '' };
      setDraft(next); setBaseline(next); setBasePhoto(avatarUrl); setPhoto(null); setRemoved(false); uploadCache.current = null; setSaved(true);
    } catch (problem) {
      if (mounted.current && operation.current === request && userRef.current?.id === ownerId) {
        const failure = problem as { message?: string; code?: string };
        if (!['cancelled', 'session_changed'].includes(failure.code ?? '')) setError({ message: failure.message || 'Could not save your profile. Your changes are still here. Please try again.', settings: failure.code === 'permission_denied' });
      }
    } finally {
      if (mounted.current && operation.current === request) { operation.current = null; setSaving(false); }
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: palette.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale accessibilityLabel="Back" testID="profile-back" disabled={busy} onPress={() => { if (!operation.current && !picker.current) navigation.goBack(); }} style={[styles.back, { backgroundColor: palette.card, borderColor: palette.border }]}><AppIcon name="back" size={23} color={palette.ink} /></PressableScale>
        <Text style={[styles.screenTitle, { color: palette.ink }]}>Edit profile</Text><View style={styles.backSpacer} />
      </View>
      {!signedIn ? (
        <View style={styles.guest}><Text style={[styles.sectionTitle, { color: palette.ink }]}>Make it personal.</Text><Text style={[styles.supporting, { color: palette.muted }]}>Sign in to add your photo and edit your profile.</Text><PressableScale accessibilityLabel="Sign in" onPress={() => { void logout(); }} style={[styles.saveButton, { backgroundColor: palette.action }]}><Text style={styles.saveText}>Sign in</Text></PressableScale></View>
      ) : (
        <>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View testID="profile-hero" style={[styles.hero, { backgroundColor: palette.hero }]}>
              <View pointerEvents="none" style={styles.heroArt}><Svg width="240" height="230" viewBox="0 0 240 230"><Circle cx="186" cy="42" r="89" fill="none" stroke="#C4B3F4" strokeOpacity="0.22" /><Circle cx="186" cy="42" r="117" fill="none" stroke="#C4B3F4" strokeOpacity="0.12" /><Path d="M24 205H216" stroke="#E2D0A6" strokeOpacity="0.18" /><Circle cx="120" cy="101" r="3" fill="#E2D0A6" fillOpacity="0.75" /></Svg></View>
              <Text style={[styles.eyebrow, { color: palette.champagne }]}>YOUR PROFILE</Text>
              <View style={styles.heroMain}>
                <View style={styles.avatarStage}>
                  <Svg style={StyleSheet.absoluteFill} width="118" height="118" viewBox="0 0 118 118"><Defs><LinearGradient id="profileRing" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#EAD7A7" /><Stop offset="0.48" stopColor="#B8A2F0" /><Stop offset="1" stopColor="#7661DD" /></LinearGradient></Defs><Circle cx="59" cy="59" r="56" fill="none" stroke="url(#profileRing)" strokeWidth="3" /></Svg>
                  <View style={styles.avatarClip}>{previewUri && !previewFailed ? <Image testID="profile-photo-preview" source={{ uri: previewUri }} onError={() => setPreviewFailed(true)} style={styles.avatar} /> : <View testID="profile-initials" style={styles.initialsWrap}><Text style={styles.initials}>{initials}</Text></View>}</View>
                  <PressableScale accessibilityLabel="Change profile photo" disabled={busy} onPress={() => { void choosePhoto('library'); }} style={[styles.cameraBadge, { backgroundColor: palette.champagne, borderColor: palette.hero }]}><AppIcon name="camera" size={18} color="#262138" /></PressableScale>
                </View>
                <View style={styles.heroText}><Text numberOfLines={2} style={styles.heroName}>{draft.displayName.trim() || 'Your name'}</Text><View style={[styles.heroRule, { backgroundColor: palette.champagne }]} /><Text style={styles.heroCaption}>{photo ? 'New photo selected' : removed ? 'Your initials, your way' : 'A familiar face. A personal touch.'}</Text></View>
              </View>
              <View style={styles.photoActions}>
                {([{ source: 'camera', label: 'Camera', icon: 'camera' }, { source: 'library', label: 'Gallery', icon: 'images' }] as const).map(action => <PressableScale key={action.source} accessibilityLabel={action.source === 'camera' ? 'Take profile photo' : 'Choose profile photo from gallery'} testID={`profile-${action.source}`} disabled={busy} onPress={() => { void choosePhoto(action.source); }} style={styles.photoAction}><AppIcon name={action.icon} size={18} color="#F6F1FF" /><Text style={styles.photoActionText}>{action.label}</Text></PressableScale>)}
              </View>
              {photo || (!removed && basePhoto) ? <PressableScale accessibilityLabel="Remove profile photo" testID="profile-remove-photo" disabled={busy} onPress={removePhoto} style={styles.removePhoto}><AppIcon name="trash" size={14} color="#D8D0E8" /><Text style={styles.removeText}>Remove photo</Text></PressableScale> : null}
            </View>

            <View testID="profile-about-card" style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeading}><View><Text style={[styles.sectionTitle, { color: palette.ink }]}>About you</Text><Text style={[styles.sectionCopy, { color: palette.muted }]}>The details that make you, you.</Text></View><AppIcon name="user-round" size={22} color={palette.violet} /></View>
              <ProfileField label="Name" value={draft.displayName} onChangeText={value => edit('displayName', value)} placeholder="Your name" maxLength={80} palette={palette} disabled={busy} />
              <ProfileField label="Bio" value={draft.bio} onChangeText={value => edit('bio', value)} placeholder="A little about you" maxLength={160} palette={palette} disabled={busy} multiline />
            </View>
            <View testID="profile-details-card" style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: palette.ink }]}>Details</Text><AppIcon name="globe" size={22} color={palette.violet} /></View>
              <ProfileField label="City" value={draft.location} onChangeText={value => edit('location', value)} placeholder="City, country" maxLength={80} palette={palette} disabled={busy} icon="location" />
              <ProfileField label="Website" value={draft.website} onChangeText={value => edit('website', value)} placeholder="yourwebsite.com" maxLength={2000} palette={palette} disabled={busy} url icon="globe" />
              <View style={[styles.mobileRow, { borderTopColor: palette.border }]}><View style={[styles.lockIcon, { backgroundColor: palette.field }]}><AppIcon name="lock" size={18} color={palette.muted} /></View><View style={{ flex: 1, gap: 4 }}><Text style={[styles.mobileLabel, { color: palette.muted }]}>Mobile number</Text><Text accessibilityLabel={`Mobile number, ${user?.phone ?? ''}, read only`} style={[styles.mobileNumber, { color: palette.ink }]}>{user?.phone}</Text><Text style={[styles.mobileHint, { color: palette.muted }]}>Your sign-in number. It stays unchanged.</Text></View></View>
            </View>
          </ScrollView>
          <View testID="profile-footer" style={[styles.footer, { backgroundColor: palette.card, borderTopColor: palette.border, paddingBottom: insets.bottom + 12 }]}>
            {error ? <View style={[styles.errorBox, { backgroundColor: palette.errorBg }]}><Text accessibilityRole="alert" style={[styles.errorText, { color: palette.error }]}>{error.message}</Text>{error.settings ? <PressableScale accessibilityLabel="Open Settings" onPress={() => { void Linking.openSettings().catch(() => setError({ message: 'Open your phone Settings to allow photo access.' })); }} style={styles.settingsAction}><Text style={[styles.settingsText, { color: palette.error }]}>Open Settings</Text></PressableScale> : null}</View> : null}
            <View style={styles.saveStatus}><View style={[styles.statusDot, { backgroundColor: saved ? palette.violet : palette.muted }]} /><Text accessibilityLiveRegion="polite" style={[styles.statusText, { color: palette.muted }]}>{saving ? phase === 'uploading' ? 'Uploading your photo…' : 'Saving your profile…' : selecting ? 'Choosing your photo…' : saved ? 'Changes saved' : dirty ? 'Unsaved changes' : 'All up to date'}</Text></View>
            <PressableScale accessibilityLabel="Save profile changes" testID="profile-save" disabled={busy || !dirty} accessibilityState={{ disabled: busy || !dirty }} onPress={() => { void save(); }} style={[styles.saveButton, { backgroundColor: palette.action, opacity: !dirty && !saved ? 0.55 : 1 }]}>{saving ? <ActivityIndicator color="#FFF" /> : <AppIcon name={saved && !dirty ? 'check' : 'check-circle'} size={20} color="#FFF" />}<Text style={styles.saveText}>Save changes</Text></PressableScale>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  back: { width: 44, height: 44, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  backSpacer: { width: 44 },
  screenTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.35 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 18 },
  hero: { borderRadius: 28, padding: 22, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: -48, top: -20 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2.4, marginBottom: 18 },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatarStage: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  avatarClip: { width: 102, height: 102, borderRadius: 51, overflow: 'hidden', backgroundColor: '#3B3457' },
  avatar: { height: '100%', width: '100%' },
  initialsWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#42365D' },
  initials: { fontSize: 34, fontWeight: '600', letterSpacing: -1, color: '#F8EDDA' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -1, height: 44, width: 44, borderRadius: 22, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, minWidth: 0, gap: 10 },
  heroName: { color: '#FAF7FF', fontSize: 27, lineHeight: 33, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.65 },
  heroRule: { width: 28, height: 2, borderRadius: 1 },
  heroCaption: { color: '#CEC5E0', fontSize: 11, lineHeight: 17 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  photoAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#FFFFFF0E', borderColor: '#FFFFFF2B', borderWidth: StyleSheet.hairlineWidth },
  photoActionText: { color: '#F6F1FF', fontSize: 13, fontWeight: '600' },
  removePhoto: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4 },
  removeText: { color: '#D8D0E8', fontSize: 11, fontWeight: '500' },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  sectionTitle: { fontSize: 21, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -0.4 },
  sectionCopy: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  field: { gap: 8 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  counter: { fontSize: 10, fontVariant: ['tabular-nums'] },
  inputWrap: { minHeight: 52, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  multilineWrap: { alignItems: 'flex-start' },
  input: { flex: 1, minHeight: 50, paddingVertical: 12, fontSize: 15 },
  bioInput: { minHeight: 104, textAlignVertical: 'top', lineHeight: 22 },
  mobileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  lockIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mobileLabel: { fontSize: 10 },
  mobileNumber: { fontSize: 14, fontWeight: '600' },
  mobileHint: { fontSize: 10, lineHeight: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  saveStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 10, fontWeight: '500' },
  saveButton: { minHeight: 54, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  saveText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.05 },
  errorBox: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  errorText: { fontSize: 12, lineHeight: 18 },
  settingsAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  settingsText: { fontSize: 12, fontWeight: '700' },
  guest: { padding: 24, gap: 20 },
  supporting: { fontSize: 14, lineHeight: 22 },
});
