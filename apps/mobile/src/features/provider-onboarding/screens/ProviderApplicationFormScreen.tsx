import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  DynamicFormRenderer,
  type FormValueUpdate,
} from '@/features/provider-onboarding/components/DynamicFormRenderer';
import {
  buildApplicationPayload,
  computeCompletion,
  hydrateFormValues,
  statusLabel,
} from '@/features/provider-onboarding/utils/formValues';
import {
  deleteProviderDocument,
  useAutosaveProviderApplicationMutation,
  useProviderApplicationQuery,
  useResolvedFormSchemaQuery,
} from '@/shared/api/providerHooks';

const AUTOSAVE_DELAY_MS = 1200;
const EDITABLE_STATUSES = new Set(['draft', 'more_info_requested']);

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export function ProviderApplicationFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ProviderApplicationForm'>>();
  const { applicationId, focusField } = route.params;
  const applicationQuery = useProviderApplicationQuery(applicationId);
  const app = applicationQuery.data;
  const schemaQuery = useResolvedFormSchemaQuery(
    app?.providerKind,
    app?.categoryIds ?? [],
  );
  const schema = schemaQuery.data;
  const autosave = useAutosaveProviderApplicationMutation(applicationId);
  const editable = app ? EDITABLE_STATUSES.has(app.status) : false;

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [uploadedDocs, setUploadedDocs] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(
    () => new Set(focusField ? [focusField] : []),
  );
  const [showAllErrors, setShowAllErrors] = useState(Boolean(focusField));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const latestValues = useRef(values);
  latestValues.current = values;
  const inFlight = useRef<Promise<void> | null>(null);
  const lastAadhaarSent = useRef<string | undefined>(undefined);

  // Hydrate once both the saved application and its form schema are ready.
  useEffect(() => {
    if (hydrated || !app || !schema) return;
    setValues(hydrateFormValues(app, schema));
    setUploadedDocs(new Set(app.documents.map(d => d.fieldKey)));
    setHydrated(true);
  }, [app, hydrated, schema]);

  const mediaPreviews = useMemo(
    () =>
      Object.fromEntries((app?.mediaPreviews ?? []).map(m => [m.mediaId, m.url])),
    [app?.mediaPreviews],
  );

  const saveNow = useCallback(async (): Promise<void> => {
    if (!editable || !schema) return;
    if (inFlight.current) {
      await inFlight.current;
      if (!dirty.current) return;
    }
    dirty.current = false;
    const payload = buildApplicationPayload(latestValues.current, schema);
    const aadhaarNumber =
      payload.aadhaarNumber && payload.aadhaarNumber !== lastAadhaarSent.current
        ? payload.aadhaarNumber
        : undefined;
    setSaveState('saving');
    const run = autosave
      .mutateAsync({
        commonPayload: payload.commonPayload as never,
        dynamicPayload: payload.dynamicPayload,
        ...(aadhaarNumber ? { aadhaarNumber } : {}),
      })
      .then(() => {
        if (aadhaarNumber) lastAadhaarSent.current = aadhaarNumber;
        setSaveState(dirty.current ? 'pending' : 'saved');
      })
      .catch(err => {
        dirty.current = true;
        setSaveState('error');
        throw err;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = run.catch(() => undefined);
    return run;
  }, [autosave, editable, schema]);

  // Debounced autosave after every change.
  useEffect(() => {
    if (!hydrated || !dirty.current || !editable) return;
    setSaveState('pending');
    const timer = setTimeout(() => {
      void saveNow().catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [values, hydrated, editable, saveNow]);

  // Flush unsaved edits when leaving the screen.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (dirty.current) void saveNow().catch(() => undefined);
      }),
    [navigation, saveNow],
  );

  const onChange = useCallback((key: string, update: FormValueUpdate) => {
    dirty.current = true;
    setValues(prev => ({
      ...prev,
      [key]:
        typeof update === 'function'
          ? (update as (previous: unknown) => unknown)(prev[key])
          : update,
    }));
  }, []);

  const onFieldBlur = useCallback((key: string) => {
    setTouched(prev => (prev.has(key) ? prev : new Set([...prev, key])));
  }, []);

  const completion = useMemo(
    () =>
      schema
        ? computeCompletion(schema, values, {
            documentKeys: uploadedDocs,
            aadhaarSaved: Boolean(app?.aadhaarMasked),
          })
        : { required: 0, done: 0, errors: {} as Record<string, string> },
    [app?.aadhaarMasked, schema, uploadedDocs, values],
  );

  const visibleErrors = useMemo(() => {
    if (showAllErrors) return completion.errors;
    return Object.fromEntries(
      Object.entries(completion.errors).filter(([key]) => touched.has(key)),
    );
  }, [completion.errors, showAllErrors, touched]);

  const onContinue = async () => {
    try {
      await saveNow();
    } catch (err) {
      Alert.alert('Could not save', (err as Error).message);
      return;
    }
    setShowAllErrors(true);
    navigation.navigate('ProviderApplicationReview', { applicationId });
  };

  if (
    applicationQuery.isLoading ||
    (app && schemaQuery.isLoading) ||
    (app && schema && !hydrated)
  ) {
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

  if (!editable) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={styles.state}>
          <Text style={[styles.stateTitle, { color: theme.colors.textPrimary }]}>
            {statusLabel(app.status)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
            This application can’t be edited while it is {statusLabel(app.status).toLowerCase()}.
          </Text>
          <Button
            title="View status"
            onPress={() =>
              navigation.replace('ProviderApplicationStatus', { applicationId: app.id })
            }
          />
        </View>
      </ScreenContainer>
    );
  }

  if (schemaQuery.isError || !schema || schema.fields.length === 0) {
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

  const saveLabel =
    saveState === 'saving'
      ? 'Saving draft…'
      : saveState === 'pending'
        ? 'Unsaved changes'
        : saveState === 'error'
          ? 'Couldn’t save. Check your connection.'
          : saveState === 'saved'
            ? 'Draft saved'
            : 'Drafts save automatically';

  return (
    <View style={styles.root}>
      {app.status === 'more_info_requested' && app.infoRequestMessage ? (
        <View style={[styles.banner, { backgroundColor: `${theme.colors.warning}1F` }]}>
          <AppIcon name="alert" size={16} color={theme.colors.warning} />
          <Text style={[styles.bannerText, { color: theme.colors.textPrimary }]}>
            Reviewer: {app.infoRequestMessage}
          </Text>
        </View>
      ) : null}
      <DynamicFormRenderer
        schema={schema}
        values={values}
        onChange={onChange}
        aadhaarMasked={app.aadhaarMasked}
        uploadedDocs={uploadedDocs}
        applicationId={app.id}
        onDocumentUploaded={fieldKey => {
          setUploadedDocs(prev => new Set([...prev, fieldKey]));
          void applicationQuery.refetch();
        }}
        onDocumentRemoved={async fieldKey => {
          await deleteProviderDocument(app.id, fieldKey);
          setUploadedDocs(prev => {
            const next = new Set(prev);
            next.delete(fieldKey);
            return next;
          });
        }}
        errors={visibleErrors}
        mediaPreviews={mediaPreviews}
        focusField={focusField}
        onFieldBlur={onFieldBlur}
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
          <AppIcon
            name={saveState === 'error' ? 'alert' : saveState === 'saved' ? 'check-circle' : 'lock'}
            size={15}
            color={saveState === 'error' ? theme.colors.error : theme.colors.primaryMuted}
          />
          <Text
            testID="autosave-status"
            style={[
              styles.savedText,
              { color: saveState === 'error' ? theme.colors.error : theme.colors.textSecondary },
            ]}
          >
            {saveLabel} · {completion.done}/{completion.required} required done
          </Text>
          {saveState === 'error' ? (
            <Button
              title="Retry"
              variant="ghost"
              onPress={() => void saveNow().catch(() => undefined)}
            />
          ) : null}
        </View>
        <Button
          title="Review application"
          onPress={() => void onContinue()}
          loading={saveState === 'saving'}
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
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
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
