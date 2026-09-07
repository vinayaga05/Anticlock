import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { ProviderKind } from '@/features/provider-onboarding/types';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useCreateProviderApplicationMutation,
  useUpdateProviderApplicationMutation,
} from '@/shared/api/providerHooks';

const OPTIONS: {
  kind: ProviderKind;
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    kind: 'business',
    title: 'Business',
    description: 'Hospital, clinic, gym, salon, agency, home-service company, etc.',
    icon: 'shop',
  },
  {
    kind: 'individual',
    title: 'Individual professional',
    description: 'Doctor, trainer, coach, tutor, nurse, freelancer, etc.',
    icon: 'user',
  },
];

export function ProviderApplicationKindScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationKind'>>();
  const [selected, setSelected] = useState<ProviderKind | null>(null);
  const create = useCreateProviderApplicationMutation();
  const update = useUpdateProviderApplicationMutation(route.params?.applicationId ?? '');

  const onContinue = async () => {
    if (!selected) return;
    try {
      let applicationId = route.params?.applicationId;
      if (!applicationId) {
        const created = await create.mutateAsync({ providerKind: selected });
        applicationId = created.id;
      } else {
        await update.mutateAsync({ providerKind: selected });
      }
      navigation.navigate('ProviderApplicationServices', { applicationId });
    } catch (error) {
      Alert.alert(
        'Could not create business',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <ScreenContainer tabAware={false}>
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <AppIcon name="sparkles" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.colors.primaryMuted }]}>NEW LISTING</Text>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>What are you creating?</Text>
            <Text style={[styles.heroText, { color: theme.colors.textSecondary }]}>Set up one business and one primary service. Add another listing whenever you need to.</Text>
          </View>
        </View>
        <View style={styles.options}>
          {OPTIONS.map(option => {
            const active = selected === option.kind;
            return (
              <PressableScale
                key={option.kind}
                onPress={() => setSelected(option.kind)}
                style={[
                  styles.card,
                  {
                    backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                    borderColor: active ? `${theme.colors.primary}55` : theme.colors.borderSoft,
                  },
                ]}>
                <View style={[styles.cardIcon, { backgroundColor: active ? `${theme.colors.primary}20` : theme.colors.surfaceMuted }]}>
                  <AppIcon name={option.icon} size={24} color={active ? theme.colors.primaryMuted : theme.colors.textSecondary} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>{option.title}</Text>
                  <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>{option.description}</Text>
                </View>
                <AppIcon name={active ? 'check-circle' : 'chevron-right'} size={22} color={active ? theme.colors.primaryMuted : theme.colors.textTertiary} />
              </PressableScale>
            );
          })}
        </View>
        <Button
          title="Continue"
          onPress={() => void onContinue()}
          disabled={!selected || create.isPending || update.isPending}
          loading={create.isPending || update.isPending}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 18,
  },
  hero: {
    alignItems: 'flex-start',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 13,
    padding: 18,
  },
  heroIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    letterSpacing: -0.3,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 19,
  },
  options: {
    gap: 12,
  },
  card: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  cardIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
