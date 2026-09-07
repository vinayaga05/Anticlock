import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useAuth } from '@/shared/context/AuthProvider';
import { createAvatarDataUri } from '@/shared/services/auth/avatar';
import { useTheme } from '@/shared/hooks/useTheme';

type FieldProps = {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  helper?: string;
  keyboardType?: 'default' | 'url';
};

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  multiline = false,
  helper,
  keyboardType = 'default',
}: FieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        maxLength={multiline ? 160 : undefined}
        style={[
          styles.input,
          multiline && styles.bioInput,
          {
            backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted,
            borderColor: theme.colors.borderSoft,
            color: editable ? theme.colors.textPrimary : theme.colors.textSecondary,
          },
        ]}
      />
      {helper ? <Text style={[styles.helper, { color: theme.colors.textTertiary }]}>{helper}</Text> : null}
    </View>
  );
}

export function EditProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(
    user?.avatarUrl?.startsWith('data:') ? '' : (user?.avatarUrl ?? ''),
  );
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setAvatarUrl(user.avatarUrl?.startsWith('data:') ? '' : (user.avatarUrl ?? ''));
    setBio(user.bio ?? '');
    setLocation(user.location ?? '');
    setWebsite(user.website ?? '');
  }, [user]);

  const previewAvatar = useMemo(() => {
    if (avatarUrl.trim()) return avatarUrl.trim();
    if (user) {
      return createAvatarDataUri({
        id: user.id,
        displayName: displayName || user.displayName,
      });
    }
    return undefined;
  }, [avatarUrl, displayName, user]);

  const save = async () => {
    const normalizedName = displayName.trim();
    const normalizedWebsite = website.trim();
    if (normalizedName.length < 2) {
      Alert.alert('Add your name', 'Enter at least two characters for your display name.');
      return;
    }
    if (normalizedWebsite && !/^https?:\/\//i.test(normalizedWebsite)) {
      Alert.alert('Check your website', 'Use a full link starting with https://.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        displayName: normalizedName,
        avatarUrl: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: normalizedWebsite || null,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Could not save profile',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          styles.topBar,
          { borderBottomColor: theme.colors.borderSoft, paddingTop: insets.top + 8 },
        ]}>
        <PressableScale
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.iconButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name="back" size={21} color={theme.colors.textPrimary} />
        </PressableScale>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Edit profile</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 104 }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
          <View style={[styles.avatarRing, { borderColor: theme.colors.primary }]}>
            {previewAvatar ? <Image source={{ uri: previewAvatar }} style={styles.avatar} /> : null}
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>Make it yours</Text>
          <Text style={[styles.heroCopy, { color: theme.colors.textSecondary }]}>A clear photo and a few details help people recognise you.</Text>
        </View>

        <ProfileField
          label="Photo link"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="https://example.com/photo.jpg"
          keyboardType="url"
          helper="Paste an image link, or leave blank to use your initials."
        />
        <ProfileField label="Name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
        <ProfileField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people a little about yourself"
          multiline
          helper={`${bio.length}/160`}
        />
        <ProfileField label="Location" value={location} onChangeText={setLocation} placeholder="City, country" />
        <ProfileField
          label="Website"
          value={website}
          onChangeText={setWebsite}
          placeholder="https://yourwebsite.com"
          keyboardType="url"
        />
        <ProfileField
          label="Mobile number"
          value={user?.phone ?? ''}
          editable={false}
          helper="Your verified number cannot be changed here."
        />

        <View style={[styles.tip, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name="lock" size={18} color={theme.colors.textSecondary} />
          <Text style={[styles.tipText, { color: theme.colors.textSecondary }]}>You control what you share. Interests and privacy choices stay in Settings.</Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderSoft,
            paddingBottom: insets.bottom + 14,
          },
        ]}>
        <Button title="Save changes" onPress={() => void save()} loading={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  iconButton: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  content: { gap: 18, padding: 20 },
  hero: { alignItems: 'center', borderRadius: 24, padding: 24 },
  avatarRing: { borderRadius: 52, borderWidth: 3, height: 104, overflow: 'hidden', width: 104 },
  avatar: { height: '100%', width: '100%' },
  heroTitle: { fontSize: 21, fontWeight: '800', marginTop: 14 },
  heroCopy: { fontSize: 14, lineHeight: 20, marginTop: 5, textAlign: 'center' },
  fieldGroup: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  input: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, fontSize: 16, minHeight: 52, paddingHorizontal: 15 },
  bioInput: { minHeight: 104, paddingTop: 14, textAlignVertical: 'top' },
  helper: { fontSize: 12, lineHeight: 17 },
  tip: { alignItems: 'flex-start', borderRadius: 16, flexDirection: 'row', gap: 10, padding: 15 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16 },
});
