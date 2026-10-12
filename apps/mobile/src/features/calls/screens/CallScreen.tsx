import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { RootStackParamList } from '@/shared/navigation/types';

export function CallScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootStackParamList, 'Call'>>();
  const { mode, name, avatarUrl } = route.params;
  const title = mode === 'video' ? 'Video call' : 'Audio call';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
      <Text style={styles.mode}>{title}</Text>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.status}>Calling…</Text>
      <View style={styles.spacer} />
      <PressableScale
        accessibilityLabel="End call"
        onPress={() => navigation.goBack()}
        style={styles.end}
      >
        <AppIcon name="phone" size={22} color="#fff" strokeWidth={2.2} />
        <Text style={styles.endLabel}>End</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  mode: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginTop: 36,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
  },
  initial: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },
  status: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    marginTop: 8,
  },
  spacer: { flex: 1 },
  end: {
    minWidth: 120,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E11D48',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  endLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
