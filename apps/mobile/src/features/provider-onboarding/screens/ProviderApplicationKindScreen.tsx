import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { ProviderKind } from '@/features/provider-onboarding/types';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useCreateProviderApplicationMutation,
  useUpdateProviderApplicationMutation,
} from '@/shared/api/providerHooks';

const OPTIONS: { kind: ProviderKind; title: string; description: string }[] = [
  {
    kind: 'business',
    title: 'Business',
    description: 'Hospital, clinic, gym, salon, agency, home-service company, etc.',
  },
  {
    kind: 'individual',
    title: 'Individual professional',
    description: 'Doctor, trainer, coach, tutor, nurse, freelancer, etc.',
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
    let applicationId = route.params?.applicationId;
    if (!applicationId) {
      const created = await create.mutateAsync({ providerKind: selected });
      applicationId = created.id;
    } else {
      await update.mutateAsync({ providerKind: selected });
    }
    navigation.navigate('ProviderApplicationServices', { applicationId });
  };

  return (
    <ScreenContainer tabAware={false}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Provider type
        </Text>
        {OPTIONS.map(option => (
          <Button
            key={option.kind}
            title={option.title}
            variant={selected === option.kind ? 'primary' : 'secondary'}
            onPress={() => setSelected(option.kind)}
            style={styles.card}
          />
        ))}
        {selected ? (
          <Text style={{ color: theme.colors.textSecondary }}>
            {OPTIONS.find(o => o.kind === selected)?.description}
          </Text>
        ) : null}
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
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    alignSelf: 'stretch',
  },
});
