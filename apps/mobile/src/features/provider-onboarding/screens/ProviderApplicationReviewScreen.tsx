import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useMyProviderApplicationQuery,
  useSubmitProviderApplicationMutation,
} from '@/shared/api/providerHooks';

export function ProviderApplicationReviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationReview'>>();
  const { data: application } = useMyProviderApplicationQuery();
  const submit = useSubmitProviderApplicationMutation(route.params.applicationId);
  const app = application?.id === route.params.applicationId ? application : null;

  const onSubmit = async () => {
    try {
      await submit.mutateAsync();
      navigation.replace('ProviderApplicationStatus', {
        applicationId: route.params.applicationId,
      });
    } catch (err) {
      Alert.alert('Submission failed', (err as Error).message);
    }
  };

  if (!app) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ padding: 20, color: theme.colors.textSecondary }}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Review & submit
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Provider type: {app.providerKind}
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Services: {app.categoryIds.join(', ')}
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Documents uploaded: {app.documents.length}
        </Text>
        {app.aadhaarMasked ? (
          <Text style={{ color: theme.colors.textSecondary }}>
            Aadhaar: {app.aadhaarMasked}
          </Text>
        ) : null}
        <Button
          title="Edit form"
          variant="secondary"
          onPress={() =>
            navigation.navigate('ProviderApplicationForm', {
              applicationId: app.id,
            })
          }
        />
        <Button
          title="Submit application"
          onPress={() => void onSubmit()}
          loading={submit.isPending}
        />
      </ScrollView>
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
  },
});
