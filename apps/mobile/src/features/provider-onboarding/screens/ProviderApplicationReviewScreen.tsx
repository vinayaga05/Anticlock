import React, { useCallback, useMemo } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useProviderApplicationQuery,
  useResolvedFormSchemaQuery,
  useSubmitProviderApplicationMutation,
} from '@/shared/api/providerHooks';
import {
  hydrateFormValues,
  statusLabel,
} from '@/features/provider-onboarding/utils/formValues';
import {
  buildReviewChecklist,
  formatFieldValue,
} from '@/features/provider-onboarding/utils/reviewModel';

const SUBMITTABLE = new Set(['draft', 'more_info_requested']);

export function ProviderApplicationReviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ProviderApplicationReview'>>();
  const applicationQuery = useProviderApplicationQuery(
    route.params.applicationId,
  );
  const app = applicationQuery.data;
  const schemaQuery = useResolvedFormSchemaQuery(
    app?.providerKind,
    app?.categoryIds ?? [],
  );
  const schema = schemaQuery.data;
  const submit = useSubmitProviderApplicationMutation(
    route.params.applicationId,
  );

  // Readiness is computed by the API from the saved draft, so refresh it
  // whenever the applicant comes back from fixing something.
  useFocusEffect(
    useCallback(() => {
      void applicationQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const checklist = useMemo(
    () => (app ? buildReviewChecklist(app, schema) : null),
    [app, schema],
  );
  const values = useMemo(
    () => (app ? hydrateFormValues(app, schema) : {}),
    [app, schema],
  );
  const logoUrl = useMemo(() => {
    const logoId = values['profile.logo'];
    return app?.mediaPreviews?.find(m => m.mediaId === logoId)?.url ?? null;
  }, [app?.mediaPreviews, values]);

  const onSubmit = async () => {
    try {
      await submit.mutateAsync();
      navigation.replace('ProviderApplicationStatus', {
        applicationId: route.params.applicationId,
      });
    } catch (err) {
      void applicationQuery.refetch();
      Alert.alert('Submission failed', (err as Error).message);
    }
  };

  if (!app || !checklist) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ padding: 20, color: theme.colors.textSecondary }}>
          Loading…
        </Text>
      </ScreenContainer>
    );
  }

  const categoryNames =
    (app.categories ?? []).map(c => c.name).join(', ') ||
    app.categoryIds.join(', ');
  const canSubmit = SUBMITTABLE.has(app.status) && checklist.complete;
  const city = [values['location.area'], values['location.city']]
    .filter(v => typeof v === 'string' && v)
    .join(', ');
  const sections = (schema?.sections ?? [])
    .map(section => ({
      section,
      rows: (schema?.fields ?? [])
        .filter(
          f =>
            f.sectionId === section.id &&
            f.type !== 'document' &&
            f.type !== 'aadhaar',
        )
        .map(f => ({ field: f, text: formatFieldValue(f, values[f.key]) })),
    }))
    .filter(s => s.rows.length > 0);

  const card = [
    styles.card,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderSoft,
    },
  ];

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Review & submit
        </Text>

        <View style={card}>
          <View style={styles.profileRow}>
            <View
              style={[
                styles.logo,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
              ) : (
                <AppIcon
                  name="shop"
                  size={26}
                  color={theme.colors.textSecondary}
                />
              )}
            </View>
            <View style={styles.flex1}>
              <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
                {app.businessName}
              </Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                {app.providerKind === 'business'
                  ? 'Business'
                  : 'Individual professional'}
                {city ? ` · ${city}` : ''}
              </Text>
              <Text
                style={{ color: theme.colors.primaryMuted, fontWeight: '700' }}
              >
                {categoryNames || 'No service selected'}
              </Text>
            </View>
          </View>
          {typeof values['profile.description'] === 'string' &&
          values['profile.description'] ? (
            <Text
              style={{ color: theme.colors.textSecondary }}
              numberOfLines={4}
            >
              {String(values['profile.description'])}
            </Text>
          ) : null}
          {app.status !== 'draft' ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              Status: {statusLabel(app.status)}
            </Text>
          ) : null}
        </View>

        <View style={card}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}
          >
            {checklist.complete
              ? 'Ready to submit'
              : `${checklist.completedCount} of ${checklist.requiredCount} required items done`}
          </Text>
          {checklist.missing.map(item => (
            <PressableScale
              key={item.key}
              accessibilityLabel={`Fix ${item.label}`}
              onPress={() =>
                navigation.navigate(item.target.screen, item.target.params)
              }
              style={styles.missingRow}
            >
              <AppIcon
                name="alert"
                size={16}
                color={
                  item.reason === 'invalid'
                    ? theme.colors.error
                    : theme.colors.warning
                }
              />
              <Text style={[styles.flex1, { color: theme.colors.textPrimary }]}>
                {item.message}
              </Text>
              <Text
                style={{ color: theme.colors.primaryMuted, fontWeight: '700' }}
              >
                Fix
              </Text>
            </PressableScale>
          ))}
          {checklist.complete ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              All required details and documents are in place.
            </Text>
          ) : null}
        </View>

        <View style={card}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}
          >
            Documents
          </Text>
          {checklist.documents.map(doc => (
            <View key={doc.key} style={styles.docRow}>
              <AppIcon
                name={doc.uploaded ? 'check-circle' : 'alert'}
                size={16}
                color={
                  doc.uploaded
                    ? theme.colors.success
                    : theme.colors.textTertiary
                }
              />
              <Text style={[styles.flex1, { color: theme.colors.textPrimary }]}>
                {doc.label}
              </Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                {doc.uploaded
                  ? doc.key === 'identity.aadhaarNumber' && app.aadhaarMasked
                    ? app.aadhaarMasked
                    : 'Uploaded'
                  : doc.required
                  ? 'Required'
                  : 'Optional'}
              </Text>
            </View>
          ))}
        </View>

        {sections.map(({ section, rows }) => (
          <View key={section.id} style={card}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {section.title}
              </Text>
              {SUBMITTABLE.has(app.status) ? (
                <PressableScale
                  onPress={() =>
                    navigation.navigate('ProviderApplicationForm', {
                      applicationId: app.id,
                      focusField: rows[0]!.field.key,
                    })
                  }
                >
                  <Text
                    style={{
                      color: theme.colors.primaryMuted,
                      fontWeight: '700',
                    }}
                  >
                    Edit
                  </Text>
                </PressableScale>
              ) : null}
            </View>
            {rows.map(({ field, text }) => (
              <View key={field.key} style={styles.valueRow}>
                <Text
                  style={[
                    styles.valueLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {field.label}
                </Text>
                <Text
                  style={[
                    styles.valueText,
                    {
                      color: text
                        ? theme.colors.textPrimary
                        : theme.colors.textTertiary,
                    },
                  ]}
                >
                  {text ?? (field.required ? 'Missing' : '—')}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {SUBMITTABLE.has(app.status) ? (
          <>
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
              title={
                app.status === 'more_info_requested'
                  ? 'Resubmit application'
                  : 'Submit application'
              }
              disabled={!canSubmit}
              onPress={() => void onSubmit()}
              loading={submit.isPending}
            />
            {!canSubmit ? (
              <Text
                style={[styles.hint, { color: theme.colors.textSecondary }]}
              >
                Complete the items above to submit.
              </Text>
            ) : null}
          </>
        ) : (
          <Button
            title="View status"
            onPress={() =>
              navigation.replace('ProviderApplicationStatus', {
                applicationId: app.id,
              })
            }
          />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700' },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 14,
  },
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  logo: {
    alignItems: 'center',
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  logoImage: { height: 60, width: 60 },
  flex1: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  missingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  docRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  valueRow: { gap: 2 },
  valueLabel: { fontSize: 12, fontWeight: '600' },
  valueText: { fontSize: 15 },
  hint: { fontSize: 12, textAlign: 'center' },
});
