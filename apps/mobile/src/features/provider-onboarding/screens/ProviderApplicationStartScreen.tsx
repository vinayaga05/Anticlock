import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/shared/components/Button';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { useTheme } from '@/shared/hooks/useTheme';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useCreateProviderApplicationMutation } from '@/shared/api/providerHooks';

/** Creates a server-owned Business draft; replaces itself so Back never revisits setup. */
export function ProviderApplicationStartScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationStart'>>();
  const { colors } = useTheme();
  const { mutateAsync } = useCreateProviderApplicationMutation();
  const request = useRef<Promise<{ id: string }> | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!request.current) request.current = route.params?.applicationId
      ? Promise.resolve({ id: route.params.applicationId }) : mutateAsync({});
    request.current.then(application => {
      if (active) navigation.replace('ProviderApplicationServices', { applicationId: application.id });
    }).catch(problem => {
      if (active) { request.current = null; setError(problem instanceof Error ? problem.message : 'Please try again.'); }
    });
    return () => { active = false; };
  }, [mutateAsync, navigation, route.params?.applicationId, retry]);
  return <ScreenContainer tabAware={false}><View style={{ padding: 24, gap: 16 }}>
    <Text style={{ color: colors.textPrimary }}>{error ?? 'Opening service registration…'}</Text>
    {error ? <Button title="Retry" onPress={() => { setError(null); setRetry(value => value + 1); }} /> : null}
  </View></ScreenContainer>;
}
