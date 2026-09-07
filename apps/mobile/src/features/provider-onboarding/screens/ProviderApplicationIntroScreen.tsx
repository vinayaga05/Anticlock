import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { isApiEnabled } from '@/shared/api/config';

export function ProviderApplicationIntroScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  return (
    <ScreenContainer tabAware={false} contentStyle={{ paddingTop: insets.top + 16 }}>
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <AppIcon name="shop" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.colors.primaryMuted }]}>GROW WITH ANTICLOCK</Text>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Become a service provider</Text>
          </View>
        </View>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          Create one business listing with a primary service, complete a tailored profile,
          and submit it for review. You can add another business whenever you need to.
        </Text>
        {!isApiEnabled ? (
          <Text style={[styles.banner, { color: theme.colors.textSecondary }]}>
            You can fill the application now. It is saved on this device until the
            API is connected.
          </Text>
        ) : null}
        <Button
          title="Create a business"
          onPress={() => navigation.navigate('ProviderApplicationKind')}
        />
        <Button title="View my businesses" variant="secondary" onPress={() => navigation.navigate('ProviderBusinesses')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  banner: {
    fontSize: 14,
  },
});
