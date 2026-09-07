import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { statusLabel } from '@/features/provider-onboarding/utils/formValues';
import {
  useDeleteProviderApplicationMutation,
  useProviderApplicationQuery,
} from '@/shared/api/providerHooks';

const STEPS = [
  'draft',
  'submitted',
  'under_review',
  'approved',
] as const;

export function ProviderApplicationStatusScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationStatus'>>();
  const { data: app, refetch } = useProviderApplicationQuery(route.params.applicationId);
  const deleteApplication = useDeleteProviderApplicationMutation();

  if (!app) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ padding: 20, color: theme.colors.textSecondary }}>Loading…</Text>
      </ScreenContainer>
    );
  }

  const canEdit = app.status === 'draft' || app.status === 'more_info_requested';
  const canDelete = app.status !== 'approved';
  const resumeEditing = () => {
    if (app.categoryIds.length === 0) {
      navigation.navigate('ProviderApplicationServices', {
        applicationId: app.id,
      });
      return;
    }

    navigation.navigate('ProviderApplicationForm', {
      applicationId: app.id,
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${app.businessName}?`,
      'This will permanently remove this business application and its uploaded documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete business',
          style: 'destructive',
          onPress: () => {
            deleteApplication.mutate(app.id, {
              onSuccess: () => navigation.replace('ProviderBusinesses'),
              onError: error => {
                Alert.alert(
                  'Could not delete business',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer tabAware={false}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {app.businessName}
        </Text>
        <Text style={[styles.status, { color: theme.colors.primary }]}>
          {statusLabel(app.status)}
        </Text>
        {app.infoRequestMessage ? (
          <Text style={{ color: theme.colors.warning }}>
            {app.infoRequestMessage}
          </Text>
        ) : null}
        <View style={styles.timeline}>
          {STEPS.map(step => {
            const active =
              app.status === step ||
              (step === 'under_review' &&
                (app.status === 'under_review' || app.status === 'more_info_requested'));
            return (
              <Text
                key={step}
                style={{
                  color: active ? theme.colors.textPrimary : theme.colors.textTertiary,
                  fontWeight: active ? '700' : '400',
                }}>
                • {statusLabel(step)}
              </Text>
            );
          })}
        </View>
        {canEdit ? (
          <Button
            title={app.categoryIds.length === 0 ? 'Choose services' : 'Continue editing'}
            onPress={resumeEditing}
          />
        ) : null}
        {canDelete ? (
          <Button
            icon="trash"
            variant="destructive"
            onPress={confirmDelete}
            disabled={deleteApplication.isPending}
            loading={deleteApplication.isPending}
            accessibilityLabel="Delete business"
            style={styles.deleteButton}
          />
        ) : null}
        {app.status === 'approved' ? (
          <Button
            title="View all businesses"
            onPress={() => navigation.navigate('ProviderBusinesses')}
          />
        ) : null}
        <Button
          title="All businesses"
          variant="secondary"
          onPress={() => navigation.navigate('ProviderBusinesses')}
        />
        <Button title="Refresh status" variant="secondary" onPress={() => void refetch()} />
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
  },
  status: {
    fontSize: 20,
    fontWeight: '600',
  },
  timeline: {
    gap: 8,
    marginVertical: 8,
  },
  deleteButton: {
    alignSelf: 'flex-start',
  },
});
