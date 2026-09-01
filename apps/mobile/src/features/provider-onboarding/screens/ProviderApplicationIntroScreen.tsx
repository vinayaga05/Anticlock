import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { isApiEnabled } from '@/shared/api/config';
import {
  useCreateProviderApplicationMutation,
  useMyProviderApplicationQuery,
} from '@/shared/api/providerHooks';

export function ProviderApplicationIntroScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { data: application } = useMyProviderApplicationQuery();
  const create = useCreateProviderApplicationMutation();

  const continueFlow = () => {
    if (application?.id) {
      if (application.status === 'approved') {
        navigation.navigate('ProviderDashboard');
        return;
      }
      if (application.categoryIds.length) {
        navigation.navigate('ProviderApplicationForm', { applicationId: application.id });
        return;
      }
      if (application.providerKind) {
        navigation.navigate('ProviderApplicationServices', { applicationId: application.id });
        return;
      }
      navigation.navigate('ProviderApplicationKind', { applicationId: application.id });
      return;
    }
    navigation.navigate('ProviderApplicationKind');
  };

  return (
    <ScreenContainer tabAware={false} contentStyle={{ paddingTop: insets.top + 16 }}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Become a Service Provider
        </Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
          Apply to list your services on Anticlock. Choose your provider type, select
          services from our catalog, and complete a tailored application form. Our team
          reviews every submission before your profile goes live.
        </Text>
        {!isApiEnabled ? (
          <Text style={[styles.banner, { color: theme.colors.textSecondary }]}>
            You can fill the application now. It is saved on this device until the
            API is connected.
          </Text>
        ) : null}
        {application ? (
          <Text style={{ color: theme.colors.textSecondary }}>
            Current status: {application.status.replace(/_/g, ' ')}
          </Text>
        ) : null}
        <Button
          title={application ? 'Continue application' : 'Start application'}
          onPress={continueFlow}
          disabled={create.isPending}
          loading={create.isPending}
        />
        {application ? (
          <Button
            title="View application status"
            variant="secondary"
            onPress={() =>
              navigation.navigate('ProviderApplicationStatus', {
                applicationId: application.id,
              })
            }
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  banner: {
    fontSize: 14,
  },
});
