import React, { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { AppIcon } from '@/shared/components/AppIcon';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { statusLabel } from '@/features/provider-onboarding/utils/formValues';
import {
  useDeleteProviderApplicationMutation,
  useProviderApplicationQuery,
  useReopenProviderApplicationMutation,
} from '@/shared/api/providerHooks';

const STATUS_COPY: Record<string, string> = {
  draft: 'Finish your details and submit when you’re ready.',
  submitted: 'Submitted. Our team will start reviewing it shortly.',
  under_review: 'Our team is reviewing your details and documents.',
  more_info_requested: 'The reviewer needs a few changes before approving.',
  approved: 'Approved! Your business is live in the marketplace.',
  rejected: 'This application was not approved. You can fix it and resubmit.',
};

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
  const { data: app, refetch, isRefetching } = useProviderApplicationQuery(
    route.params.applicationId,
  );
  const deleteApplication = useDeleteProviderApplicationMutation();
  const reopen = useReopenProviderApplicationMutation(route.params.applicationId);

  // A reviewer decision may arrive while the app is open (push/in-app), so
  // re-read the status every time this screen gains focus.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  if (!app) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ padding: 20, color: theme.colors.textSecondary }}>Loading…</Text>
      </ScreenContainer>
    );
  }

  const canEdit = app.status === 'draft' || app.status === 'more_info_requested';
  const canDelete = app.status !== 'approved' && !app.providerId;
  const onReopen = () => {
    reopen.mutate(undefined, {
      onSuccess: () =>
        navigation.navigate('ProviderApplicationForm', { applicationId: app.id }),
      onError: error =>
        Alert.alert('Could not reopen', error instanceof Error ? error.message : 'Try again.'),
    });
  };
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

  const reviewerMessage =
    app.status === 'more_info_requested' ? app.infoRequestMessage : null;
  const reviewerNotes =
    app.status === 'rejected' || app.status === 'more_info_requested'
      ? app.reviewNotes && app.reviewNotes !== reviewerMessage
        ? app.reviewNotes
        : null
      : null;

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {app.businessName}
        </Text>
        <Text
          style={[
            styles.status,
            {
              color:
                app.status === 'rejected'
                  ? theme.colors.error
                  : app.status === 'more_info_requested'
                    ? theme.colors.warning
                    : theme.colors.primary,
            },
          ]}>
          {statusLabel(app.status)}
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          {STATUS_COPY[app.status] ?? ''}
        </Text>
        {reviewerMessage || reviewerNotes ? (
          <View
            style={[
              styles.noteCard,
              {
                backgroundColor:
                  app.status === 'rejected'
                    ? `${theme.colors.error}14`
                    : `${theme.colors.warning}1A`,
              },
            ]}>
            <View style={styles.noteHeader}>
              <AppIcon name="message-circle" size={16} color={theme.colors.textPrimary} />
              <Text style={[styles.noteTitle, { color: theme.colors.textPrimary }]}>
                Reviewer notes
              </Text>
            </View>
            {reviewerMessage ? (
              <Text style={{ color: theme.colors.textPrimary }}>{reviewerMessage}</Text>
            ) : null}
            {reviewerNotes ? (
              <Text style={{ color: theme.colors.textPrimary }}>{reviewerNotes}</Text>
            ) : null}
          </View>
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
        {app.status === 'more_info_requested' ? (
          <Button title="Edit & resubmit" onPress={resumeEditing} />
        ) : canEdit ? (
          <Button
            title={app.categoryIds.length === 0 ? 'Choose services' : 'Continue editing'}
            onPress={resumeEditing}
          />
        ) : null}
        {app.status === 'rejected' ? (
          <Button
            title="Fix & resubmit"
            onPress={onReopen}
            loading={reopen.isPending}
          />
        ) : null}
        {app.status === 'approved' && app.providerId ? (
          <Button
            title="Open business dashboard"
            onPress={() =>
              navigation.navigate('ProviderDashboard', { providerId: app.providerId })
            }
          />
        ) : null}
        <Button
          title="All businesses"
          variant="secondary"
          onPress={() => navigation.navigate('ProviderBusinesses')}
        />
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
  noteCard: {
    borderRadius: 14,
    gap: 6,
    padding: 14,
  },
  noteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
});
