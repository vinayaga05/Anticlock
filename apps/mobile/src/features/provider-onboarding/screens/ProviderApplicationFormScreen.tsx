import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { DynamicFormRenderer } from '@/features/provider-onboarding/components/DynamicFormRenderer';
import {
  COMMON_SECTION_PREFIXES,
  splitFormValues,
} from '@/features/provider-onboarding/utils/formValues';
import {
  useProviderApplicationQuery,
  useResolvedFormSchemaQuery,
  useUpdateProviderApplicationMutation,
} from '@/shared/api/providerHooks';

export function ProviderApplicationFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ProviderApplicationForm'>>();
  const applicationQuery = useProviderApplicationQuery(
    route.params.applicationId,
  );
  const app = applicationQuery.data;
  const schemaQuery = useResolvedFormSchemaQuery(
    app?.providerKind,
    app?.categoryIds ?? [],
  );
  const update = useUpdateProviderApplicationMutation(
    route.params.applicationId,
  );

  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    const flatten = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value as Record<string, unknown>, full);
        } else {
          values[full] = value;
        }
      }
    };
    flatten((app?.commonPayload ?? {}) as Record<string, unknown>);
    Object.assign(values, app?.dynamicPayload ?? {});
    return values;
  }, [app]);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [hydrated, setHydrated] = useState(false);
  if (app && !hydrated) {
    setValues(initialValues);
    setHydrated(true);
  }
  const [uploadedDocs, setUploadedDocs] = useState(
    () =>
      new Set(
        app?.documents.map((d: { fieldKey: string }) => d.fieldKey) ?? [],
      ),
  );

  const onChange = (key: string, value: unknown) => {
    setValues(prev => {
      const next = { ...prev, [key]: value };
      return next;
    });
  };

  const onSave = async () => {
    const { commonPayload, dynamicPayload } = splitFormValues(
      values,
      COMMON_SECTION_PREFIXES,
    );
    const aadhaarNumber =
      typeof values['identity.aadhaarNumber'] === 'string'
        ? values['identity.aadhaarNumber']
        : undefined;

    await update.mutateAsync({
      commonPayload: commonPayload as never,
      dynamicPayload,
      aadhaarNumber,
    });
    navigation.navigate('ProviderApplicationReview', {
      applicationId: route.params.applicationId,
    });
  };

  if (applicationQuery.isLoading || (app && schemaQuery.isLoading)) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ color: theme.colors.textSecondary, padding: 20 }}>
          Loading application form…
        </Text>
      </ScreenContainer>
    );
  }

  if (applicationQuery.isError || !app) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.state}>
          <Text
            style={[styles.stateTitle, { color: theme.colors.textPrimary }]}
          >
            We couldn’t open this business
          </Text>
          <Text
            style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
          >
            {applicationQuery.error instanceof Error
              ? applicationQuery.error.message
              : 'Please check your connection and try again.'}
          </Text>
          <Button
            title="Try again"
            onPress={() => void applicationQuery.refetch()}
          />
        </View>
      </ScreenContainer>
    );
  }

  if (app.categoryIds.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.state}>
          <Text
            style={[styles.stateTitle, { color: theme.colors.textPrimary }]}
          >
            Choose your services first
          </Text>
          <Text
            style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
          >
            Your application form is tailored to the services you offer.
          </Text>
          <Button
            title="Choose services"
            onPress={() =>
              navigation.replace('ProviderApplicationServices', {
                applicationId: app.id,
              })
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  if (
    schemaQuery.isError ||
    !schemaQuery.data ||
    schemaQuery.data.fields.length === 0
  ) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.state}>
          <Text
            style={[styles.stateTitle, { color: theme.colors.textPrimary }]}
          >
            Application form is unavailable
          </Text>
          <Text
            style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
          >
            {schemaQuery.error instanceof Error
              ? schemaQuery.error.message
              : 'No form has been configured for these services yet.'}
          </Text>
          <Button
            title="Try again"
            onPress={() => void schemaQuery.refetch()}
          />
          <Button
            title="Change services"
            variant="secondary"
            onPress={() =>
              navigation.replace('ProviderApplicationServices', {
                applicationId: app.id,
              })
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <DynamicFormRenderer
        schema={schemaQuery.data}
        values={values}
        onChange={onChange}
        aadhaarMasked={app.aadhaarMasked}
        uploadedDocs={uploadedDocs}
        applicationId={app.id}
        onDocumentUploaded={fieldKey =>
          setUploadedDocs(prev => new Set([...prev, fieldKey]))
        }
      />
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.borderSoft,
          },
        ]}
      >
        <View style={styles.savedNote}>
          <AppIcon name="lock" size={15} color={theme.colors.primaryMuted} />
          <Text
            style={[styles.savedText, { color: theme.colors.textSecondary }]}
          >
            Your progress is saved automatically
          </Text>
        </View>
        <Button
          title="Save & continue"
          onPress={() => {
            void onSave().catch(err => {
              Alert.alert('Could not save', (err as Error).message);
            });
          }}
          loading={update.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedNote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  savedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  state: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
