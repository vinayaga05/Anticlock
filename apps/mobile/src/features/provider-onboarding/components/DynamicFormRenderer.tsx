import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  FormFieldDefinition,
  ResolvedProviderFormSchema,
} from '@/features/provider-onboarding/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { isApiEnabled } from '@/shared/api/config';
import { addLocalDocument } from '@/features/provider-onboarding/localApplicationStore';
import {
  ProviderMediaField,
  type UploadItem,
} from '@/features/provider-onboarding/components/ProviderMediaField';
import {
  DateField,
  TimeField,
} from '@/features/provider-onboarding/components/DateTimeFields';

export type FormValueUpdate = unknown | ((previous: unknown) => unknown);

type Props = {
  schema: ResolvedProviderFormSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: FormValueUpdate) => void;
  aadhaarMasked?: string | null;
  uploadedDocs?: Set<string>;
  applicationId?: string;
  onDocumentUploaded?: (fieldKey: string) => void;
  onDocumentRemoved?: (fieldKey: string) => Promise<void> | void;
  /** Field errors to display (already filtered to touched fields). */
  errors?: Record<string, string>;
  /** mediaId -> preview URL for saved profile media. */
  mediaPreviews?: Record<string, string | null | undefined>;
  /** Opens this field's section and scrolls to it (review "Fix" links). */
  focusField?: string;
  onFieldBlur?: (key: string) => void;
};

const SECTION_DETAILS: Record<string, { icon: IconName; description: string }> =
  {
    basic: { icon: 'shop', description: 'Tell customers who you are' },
    location: { icon: 'map-pin', description: 'Add your business address' },
    profile: { icon: 'user', description: 'Share what makes you different' },
    identity: {
      icon: 'badge-check',
      description: 'Verify your identity and documents',
    },
    availability: { icon: 'clock', description: 'Set your working hours' },
    services: {
      icon: 'clipboard-list',
      description: 'Set how customers can book you',
    },
    hospital: { icon: 'hospital', description: 'Add facilities and services' },
    medical: {
      icon: 'stethoscope',
      description: 'Add your professional credentials',
    },
    gym: {
      icon: 'dumbbell',
      description: 'Add facilities and membership details',
    },
    trainer: { icon: 'activity', description: 'Add expertise and packages' },
    coaching: {
      icon: 'graduation-cap',
      description: 'Add your course details',
    },
    homeservice: { icon: 'home', description: 'Add service areas and pricing' },
    food: { icon: 'shop', description: 'Add menu and delivery details' },
  };

function getValue(values: Record<string, unknown>, key: string) {
  if (key in values) return values[key];
  const parts = key.split('.');
  let current: unknown = values;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

async function localUpload(opts: {
  applicationId: string;
  fieldKey: string;
  purpose: 'document' | 'profile';
  file: { uri: string };
  onProgress?: (fraction: number) => void;
}) {
  // API disabled (offline demo): keep the picked file locally.
  opts.onProgress?.(1);
  if (opts.purpose === 'document') addLocalDocument(opts.applicationId, opts.fieldKey);
  return { mediaId: `local-${Date.now()}`, url: opts.file.uri };
}

function mediaIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return typeof value === 'string' && value ? [value] : [];
}

function FieldInput({
  field,
  value,
  onChange,
  aadhaarMasked,
  uploaded,
  applicationId,
  onDocumentUploaded,
  onDocumentRemoved,
  mediaPreviews,
  onPreview,
  hasError,
  onBlur,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (value: FormValueUpdate) => void;
  aadhaarMasked?: string | null;
  uploaded?: boolean;
  applicationId?: string;
  onDocumentUploaded?: (fieldKey: string) => void;
  onDocumentRemoved?: (fieldKey: string) => Promise<void> | void;
  mediaPreviews?: Record<string, string | null | undefined>;
  onPreview: (mediaId: string, uri?: string | null) => void;
  hasError?: boolean;
  onBlur?: () => void;
}) {
  const theme = useTheme();
  const [editingAadhaar, setEditingAadhaar] = useState(false);
  const inputStyle = [
    styles.input,
    {
      color: theme.colors.textPrimary,
      borderColor: hasError ? theme.colors.error : theme.colors.borderSoft,
    },
  ];

  if (field.type === 'boolean') {
    return <Switch value={Boolean(value)} onValueChange={onChange} />;
  }

  if (field.type === 'aadhaar') {
    if (aadhaarMasked && !editingAadhaar) {
      return (
        <View style={styles.inlineRow}>
          <Text style={[styles.maskedText, { color: theme.colors.textPrimary }]}>
            {aadhaarMasked}
          </Text>
          <Button title="Change" variant="ghost" onPress={() => setEditingAadhaar(true)} />
        </View>
      );
    }
    return (
      <TextInput
        style={inputStyle}
        placeholder="12-digit Aadhaar"
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType="number-pad"
        value={String(value ?? '')}
        onChangeText={text => onChange(text.replace(/\D/g, ''))}
        onBlur={onBlur}
        maxLength={12}
      />
    );
  }

  if (field.type === 'document' || field.type === 'image' || field.type === 'video') {
    if (!applicationId) return null;
    const isDocument = field.type === 'document';
    const multiple = field.key === 'profile.coverImages';
    const ids = mediaIds(value);
    const initialItems: UploadItem[] = isDocument
      ? uploaded
        ? [{ id: `doc-${field.key}`, status: 'uploaded', progress: 1, filename: `${field.label} uploaded` }]
        : []
      : ids.map(id => ({
          id,
          status: 'uploaded' as const,
          progress: 1,
          mediaId: id,
          previewUri: mediaPreviews?.[id] ?? null,
          filename: field.type === 'video' ? 'Intro video' : null,
        }));
    return (
      <ProviderMediaField
        applicationId={applicationId}
        fieldKey={field.key}
        label={field.label}
        kind={field.type === 'document' ? 'document' : field.type}
        purpose={isDocument ? 'document' : 'profile'}
        multiple={multiple}
        initialItems={initialItems}
        upload={isApiEnabled ? undefined : (localUpload as never)}
        onUploaded={(mediaId, previewUri) => {
          if (isDocument) {
            onDocumentUploaded?.(field.key);
            return;
          }
          onPreview(mediaId, previewUri);
          onChange(multiple ? (prev: unknown) => [...mediaIds(prev), mediaId] : mediaId);
        }}
        onRemoved={async mediaId => {
          if (isDocument) {
            await onDocumentRemoved?.(field.key);
            return;
          }
          onChange((prev: unknown) =>
            multiple ? mediaIds(prev).filter(id => id !== mediaId) : prev === mediaId ? null : prev,
          );
        }}
      />
    );
  }

  if (field.type === 'date') {
    return <DateField value={value} onChange={onChange} label={field.label} hasError={hasError} />;
  }

  if (field.type === 'time') {
    return <TimeField value={value} onChange={onChange} label={field.label} hasError={hasError} />;
  }

  if (field.type === 'location') {
    const loc =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const setPart = (part: 'latitude' | 'longitude', text: string) => {
      // Accept a pasted "12.97, 77.59" pair in either box.
      const pair = text.split(',').map(t => t.trim());
      if (pair.length === 2 && pair[0] && pair[1]) {
        onChange({ latitude: pair[0], longitude: pair[1] });
        return;
      }
      onChange({ ...loc, [part]: text });
    };
    return (
      <View style={styles.inlineRow}>
        <TextInput
          style={[inputStyle, styles.flex1]}
          placeholder="Latitude"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          value={loc.latitude == null ? '' : String(loc.latitude)}
          onChangeText={text => setPart('latitude', text)}
          onBlur={onBlur}
        />
        <TextInput
          style={[inputStyle, styles.flex1]}
          placeholder="Longitude"
          placeholderTextColor={theme.colors.textTertiary}
          keyboardType="numbers-and-punctuation"
          value={loc.longitude == null ? '' : String(loc.longitude)}
          onChangeText={text => setPart('longitude', text)}
          onBlur={onBlur}
        />
      </View>
    );
  }

  if (field.type === 'multiselect' && field.options?.length) {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return (
      <View style={styles.optionWrap}>
        {field.options.map(opt => {
          const active = selected.has(opt.value);
          return (
            <Button
              key={opt.value}
              title={opt.label}
              variant={active ? 'primary' : 'secondary'}
              onPress={() => {
                const next = new Set(selected);
                if (active) next.delete(opt.value);
                else next.add(opt.value);
                onChange(Array.from(next));
              }}
              style={styles.optionBtn}
            />
          );
        })}
      </View>
    );
  }

  if (field.type === 'dropdown' && field.options?.length) {
    const current = typeof value === 'string' ? value : '';
    return (
      <View style={styles.optionWrap}>
        {field.options.map(opt => (
          <Button
            key={opt.value}
            title={opt.label}
            variant={current === opt.value ? 'primary' : 'secondary'}
            onPress={() => onChange(opt.value)}
            style={styles.optionBtn}
          />
        ))}
      </View>
    );
  }

  const multiline = field.type === 'textarea';
  const numeric = field.type === 'number' || field.type === 'currency';
  const keyboardType = numeric
    ? 'decimal-pad'
    : field.type === 'phone'
      ? 'phone-pad'
      : field.type === 'email'
        ? 'email-address'
        : 'default';

  return (
    <View style={styles.inlineRow}>
      {field.type === 'currency' ? (
        <Text style={[styles.prefix, { color: theme.colors.textSecondary }]}>₹</Text>
      ) : null}
      <TextInput
        style={[inputStyle, multiline && styles.textarea, styles.flex1]}
        placeholder={field.label}
        placeholderTextColor={theme.colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={field.type === 'email' ? 'none' : undefined}
        autoCorrect={field.type === 'email' ? false : undefined}
        value={value == null ? '' : String(value)}
        onChangeText={onChange}
        onBlur={onBlur}
      />
    </View>
  );
}

export function DynamicFormRenderer({
  schema,
  values,
  onChange,
  aadhaarMasked,
  uploadedDocs,
  applicationId,
  onDocumentUploaded,
  onDocumentRemoved,
  errors = {},
  mediaPreviews,
  focusField,
  onFieldBlur,
}: Props) {
  const theme = useTheme();
  const focusSection = focusField
    ? schema.fields.find(f => f.key === focusField)?.sectionId
    : undefined;
  const [openSection, setOpenSection] = useState(
    focusSection ?? schema.sections[0]?.id ?? '',
  );
  const [localPreviews, setLocalPreviews] = useState<Record<string, string | null | undefined>>({});
  const previews = useMemo(
    () => ({ ...(mediaPreviews ?? {}), ...localPreviews }),
    [mediaPreviews, localPreviews],
  );
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const fieldY = useRef<Record<string, number>>({});
  const pendingScroll = useRef<string | undefined>(focusField);

  useEffect(() => {
    if (focusSection) {
      setOpenSection(focusSection);
      pendingScroll.current = focusField;
    }
  }, [focusField, focusSection]);

  const tryScrollToFocus = () => {
    const key = pendingScroll.current;
    if (!key) return;
    const field = schema.fields.find(f => f.key === key);
    if (!field) return;
    const sy = sectionY.current[field.sectionId];
    const fy = fieldY.current[key];
    if (sy === undefined || fy === undefined) return;
    pendingScroll.current = undefined;
    scrollRef.current?.scrollTo({ y: Math.max(0, sy + fy - 24), animated: true });
  };

  const isFieldDone = (field: FormFieldDefinition) => {
    if (field.type === 'document') return Boolean(uploadedDocs?.has(field.key));
    if (field.type === 'aadhaar') {
      return Boolean(aadhaarMasked) || /^\d{12}$/.test(String(values[field.key] ?? ''));
    }
    return hasValue(getValue(values, field.key)) && !errors[field.key];
  };

  const fieldsBySection = useMemo(() => {
    const map = new Map<string, FormFieldDefinition[]>();
    for (const field of schema.fields) {
      const list = map.get(field.sectionId) ?? [];
      list.push(field);
      map.set(field.sectionId, list);
    }
    return map;
  }, [schema.fields]);

  const visibleSections = useMemo(
    () =>
      schema.sections.filter(
        section => (fieldsBySection.get(section.id) ?? []).length > 0,
      ),
    [fieldsBySection, schema.sections],
  );

  useEffect(() => {
    if (!visibleSections.some(section => section.id === openSection)) {
      setOpenSection(visibleSections[0]?.id ?? '');
    }
  }, [openSection, visibleSections]);

  const activeStep = Math.max(
    visibleSections.findIndex(section => section.id === openSection) + 1,
    1,
  );

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.progressHeader}>
        <Text style={[styles.eyebrow, { color: theme.colors.primaryMuted }]}>
          BUSINESS PROFILE
        </Text>
        <Text
          style={[styles.progressTitle, { color: theme.colors.textPrimary }]}
        >
          Step {activeStep} of {visibleSections.length}
        </Text>
        <View style={styles.progressTrack}>
          {visibleSections.map((section, index) => (
            <View
              key={section.id}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index < activeStep
                      ? theme.colors.primary
                      : theme.colors.surfaceMuted,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {visibleSections.map(section => {
        const fields = fieldsBySection.get(section.id) ?? [];
        const isOpen = openSection === section.id;
        const required = fields.filter(field => field.required);
        const isComplete =
          required.length > 0 && required.every(field => isFieldDone(field));
        const completedCount = fields.filter(field => isFieldDone(field)).length;
        const sectionErrors = fields.filter(field => errors[field.key]).length;
        const details = SECTION_DETAILS[section.id] ?? {
          icon: 'clipboard-list' as IconName,
          description: 'Add the details customers need to know',
        };
        return (
          <View
            key={section.id}
            onLayout={event => {
              sectionY.current[section.id] = event.nativeEvent.layout.y;
              tryScrollToFocus();
            }}
            style={[
              styles.section,
              {
                borderColor: isOpen
                  ? `${theme.colors.primary}40`
                  : theme.colors.borderSoft,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <PressableScale
              onPress={() => setOpenSection(isOpen ? '' : section.id)}
              style={styles.sectionHeader}
            >
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: theme.colors.primarySoft },
                ]}
              >
                <AppIcon
                  name={details.icon}
                  size={21}
                  color={theme.colors.primaryMuted}
                />
              </View>
              <View style={styles.sectionCopy}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  {section.title}
                </Text>
                <Text
                  style={[
                    styles.sectionDescription,
                    { color: theme.colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {details.description}
                </Text>
              </View>
              {sectionErrors > 0 ? (
                <View style={[styles.completeBadge, { backgroundColor: `${theme.colors.error}1A` }]}>
                  <Text style={[styles.completeText, { color: theme.colors.error }]}>
                    {sectionErrors} to fix
                  </Text>
                </View>
              ) : isComplete ? (
                <View
                  style={[
                    styles.completeBadge,
                    { backgroundColor: theme.colors.primarySoft },
                  ]}
                >
                  <AppIcon
                    name="check-circle"
                    size={15}
                    color={theme.colors.primaryMuted}
                  />
                  <Text
                    style={[
                      styles.completeText,
                      { color: theme.colors.primaryMuted },
                    ]}
                  >
                    Done
                  </Text>
                </View>
              ) : null}
              <AppIcon
                name={isOpen ? 'chevron-down' : 'chevron-right'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </PressableScale>
            {isOpen ? (
              <View
                style={[
                  styles.sectionContent,
                  { borderTopColor: theme.colors.borderSoft },
                ]}
              >
                <Text
                  style={[
                    styles.sectionStatus,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {completedCount} of {fields.length} details completed
                </Text>
                {fields.map(field => (
                  <View
                    key={field.key}
                    style={styles.field}
                    onLayout={event => {
                      fieldY.current[field.key] = event.nativeEvent.layout.y;
                      tryScrollToFocus();
                    }}>
                    <Text
                      style={[
                        styles.label,
                        { color: theme.colors.textPrimary },
                      ]}
                    >
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Text>
                    {field.helpText ? (
                      <Text
                        style={{
                          color: theme.colors.textSecondary,
                          marginBottom: 6,
                        }}
                      >
                        {field.helpText}
                      </Text>
                    ) : null}
                    <FieldInput
                      field={field}
                      value={getValue(values, field.key)}
                      onChange={val => onChange(field.key, val)}
                      aadhaarMasked={
                        field.type === 'aadhaar' ? aadhaarMasked : undefined
                      }
                      uploaded={uploadedDocs?.has(field.key)}
                      applicationId={applicationId}
                      onDocumentUploaded={onDocumentUploaded}
                      onDocumentRemoved={onDocumentRemoved}
                      mediaPreviews={previews}
                      onPreview={(mediaId, uri) =>
                        setLocalPreviews(prev => ({ ...prev, [mediaId]: uri }))
                      }
                      hasError={Boolean(errors[field.key])}
                      onBlur={() => onFieldBlur?.(field.key)}
                    />
                    {errors[field.key] ? (
                      <Text style={[styles.errorText, { color: theme.colors.error }]}>
                        {errors[field.key]}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  progressHeader: {
    alignItems: 'center',
    gap: 7,
    paddingBottom: 8,
    paddingTop: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  progressTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  progressSegment: {
    borderRadius: 100,
    flex: 1,
    height: 5,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    padding: 14,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  sectionCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  completeBadge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  completeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    padding: 16,
  },
  sectionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  field: {
    gap: 7,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    minWidth: 0,
  },
  inlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '700',
  },
  maskedText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
