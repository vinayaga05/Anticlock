import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import { DynamicFormRenderer } from '@/features/provider-onboarding/components/DynamicFormRenderer';
import {
  COMMON_SECTION_PREFIXES,
  splitFormValues,
} from '@/features/provider-onboarding/utils/formValues';
import {
  useMyProviderApplicationQuery,
  useResolvedFormSchemaQuery,
  useUpdateProviderApplicationMutation,
} from '@/shared/api/providerHooks';

export function ProviderApplicationFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderApplicationForm'>>();
  const { data: application } = useMyProviderApplicationQuery();
  const app = application?.id === route.params.applicationId ? application : null;
  const schemaQuery = useResolvedFormSchemaQuery(
    app?.providerKind,
    app?.categoryIds ?? [],
  );
  const update = useUpdateProviderApplicationMutation(route.params.applicationId);

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
    () => new Set(app?.documents.map((d: { fieldKey: string }) => d.fieldKey) ?? []),
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

  if (!app || !schemaQuery.data) {
    return (
      <ScreenContainer tabAware={false}>
        <Text style={{ color: theme.colors.textSecondary, padding: 20 }}>
          Loading application form…
        </Text>
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
      <View style={[styles.footer, { borderTopColor: theme.colors.borderSoft }]}>
        <Button
          title="Save & review"
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
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
