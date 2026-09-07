import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  useDeleteProviderApplicationMutation,
  useProviderApplicationsQuery,
} from '@/shared/api/providerHooks';
import { statusLabel } from '@/features/provider-onboarding/utils/formValues';

function statusStyle(status: string, theme: ReturnType<typeof useTheme>) {
  if (status === 'approved') return { bg: 'rgba(34, 197, 94, 0.14)', color: theme.colors.success };
  if (status === 'rejected') return { bg: 'rgba(239, 68, 68, 0.12)', color: theme.colors.error };
  if (status === 'more_info_requested') return { bg: 'rgba(245, 158, 11, 0.14)', color: theme.colors.warning };
  if (status === 'draft') return { bg: theme.colors.surfaceMuted, color: theme.colors.textSecondary };
  return { bg: theme.colors.primarySoft, color: theme.colors.primaryMuted };
}

export function ProviderBusinessesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { data: applications = [], isLoading, refetch } = useProviderApplicationsQuery();
  const deleteApplication = useDeleteProviderApplicationMutation();

  const resumeEditing = (application: (typeof applications)[number]) => {
    if (application.categoryIds.length === 0) {
      navigation.navigate('ProviderApplicationServices', {
        applicationId: application.id,
      });
      return;
    }
    navigation.navigate('ProviderApplicationForm', {
      applicationId: application.id,
    });
  };

  const confirmDelete = (application: (typeof applications)[number]) => {
    Alert.alert(
      `Delete ${application.businessName}?`,
      'This will permanently remove this business application and its uploaded documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete business',
          style: 'destructive',
          onPress: () => {
            deleteApplication.mutate(application.id, {
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
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <PressableScale
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={[styles.back, { backgroundColor: theme.colors.surfaceMuted }]}>
            <AppIcon name="back" size={21} color={theme.colors.textPrimary} />
          </PressableScale>
          <Text style={[styles.topTitle, { color: theme.colors.textPrimary }]}>My businesses</Text>
          <View style={styles.back} />
        </View>

        <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primary }]}>
            <AppIcon name="badge-check" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.colors.textPrimary }]}>Your submitted businesses</Text>
            <Text style={[styles.heroText, { color: theme.colors.textSecondary }]}>Only businesses sent for review or approved by our team appear here.</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Under review & live</Text>
          <Text style={[styles.count, { color: theme.colors.textSecondary }]}>{applications.length}</Text>
        </View>

        {isLoading ? (
          <Text style={[styles.loading, { color: theme.colors.textSecondary }]}>Loading your businesses…</Text>
        ) : applications.length ? (
          <View style={styles.list}>
            {applications.map(application => {
              const badge = statusStyle(application.status, theme);
              const editable = application.status === 'draft' || application.status === 'more_info_requested';
              const deletable = application.status !== 'approved';
              return (
                <View
                  key={application.id}
                  style={[
                    styles.businessCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderSoft,
                    },
                  ]}>
                  <PressableScale
                    onPress={() =>
                      navigation.navigate('ProviderApplicationStatus', {
                        applicationId: application.id,
                      })
                    }
                    style={styles.businessPress}>
                    <View style={[styles.businessIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <AppIcon name={application.providerKind === 'business' ? 'shop' : 'user'} size={21} color={theme.colors.primaryMuted} />
                    </View>
                    <View style={styles.businessBody}>
                      <Text style={[styles.businessName, { color: theme.colors.textPrimary }]} numberOfLines={1}>{application.businessName}</Text>
                      <Text style={[styles.businessMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {application.categoryIds.length ? 'Primary service selected' : editable ? 'Finish your application' : application.providerKind === 'business' ? 'Business' : 'Professional'}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusText, { color: badge.color }]}>{statusLabel(application.status)}</Text>
                      </View>
                    </View>
                    <AppIcon name="chevron-right" size={20} color={theme.colors.textTertiary} />
                  </PressableScale>
                  {editable || deletable ? (
                    <View style={[styles.businessActions, { borderTopColor: theme.colors.borderSoft }]}>
                      {editable ? (
                        <Button
                          icon="edit"
                          variant="icon"
                          onPress={() => resumeEditing(application)}
                          style={styles.actionIcon}
                          accessibilityLabel={`Edit ${application.businessName}`}
                        />
                      ) : null}
                      {deletable ? (
                        <Button
                          icon="trash"
                          variant="destructive"
                          onPress={() => confirmDelete(application)}
                          disabled={deleteApplication.isPending}
                          style={styles.actionIcon}
                          accessibilityLabel={`Delete ${application.businessName}`}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.empty, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
            <AppIcon name="shop" size={30} color={theme.colors.primary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>No submitted businesses yet</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Complete and submit a business profile to send it for admin approval. Unfinished drafts are not saved here.</Text>
          </View>
        )}

        <Button title="Add another business" icon="plus" onPress={() => navigation.navigate('ProviderApplicationKind')} />
        {applications.length ? <Button title="Refresh status" variant="secondary" onPress={() => void refetch()} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 20 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  back: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  topTitle: { fontSize: 17, fontWeight: '800' },
  hero: { alignItems: 'center', borderRadius: 22, flexDirection: 'row', gap: 14, padding: 18 },
  heroIcon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '800' },
  heroText: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  count: { fontSize: 14, fontWeight: '700' },
  list: { gap: 10 },
  businessCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  businessPress: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 },
  businessIcon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  businessBody: { flex: 1, gap: 3 },
  businessName: { fontSize: 16, fontWeight: '800' },
  businessMeta: { fontSize: 13 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 9, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  businessActions: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, justifyContent: 'flex-end', padding: 10 },
  actionIcon: { height: 42, minHeight: 42, width: 42 },
  empty: { alignItems: 'center', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 9, padding: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  loading: { paddingVertical: 24, textAlign: 'center' },
});
