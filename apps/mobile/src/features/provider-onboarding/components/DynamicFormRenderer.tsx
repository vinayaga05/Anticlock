import React, { useEffect, useMemo, useState } from 'react';
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

type Props = {
  schema: ResolvedProviderFormSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  aadhaarMasked?: string | null;
  uploadedDocs?: Set<string>;
  applicationId?: string;
  onDocumentUploaded?: (fieldKey: string) => void;
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

function FieldInput({
  field,
  value,
  onChange,
  aadhaarMasked,
  uploaded,
  applicationId,
  onDocumentUploaded,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  aadhaarMasked?: string | null;
  uploaded?: boolean;
  applicationId?: string;
  onDocumentUploaded?: (fieldKey: string) => void;
}) {
  const theme = useTheme();

  if (field.type === 'boolean') {
    return <Switch value={Boolean(value)} onValueChange={onChange} />;
  }

  if (field.type === 'aadhaar') {
    return (
      <TextInput
        style={[
          styles.input,
          {
            color: theme.colors.textPrimary,
            borderColor: theme.colors.borderSoft,
          },
        ]}
        placeholder={aadhaarMasked ? 'Saved (masked)' : '12-digit Aadhaar'}
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType="number-pad"
        secureTextEntry={Boolean(aadhaarMasked)}
        editable={!aadhaarMasked}
        value={aadhaarMasked ? aadhaarMasked : String(value ?? '')}
        onChangeText={onChange}
        maxLength={12}
      />
    );
  }

  if (
    field.type === 'document' ||
    field.type === 'image' ||
    field.type === 'video'
  ) {
    return (
      <View>
        <Text style={{ color: theme.colors.textSecondary }}>
          {uploaded ? 'Document uploaded' : 'Upload a file for verification'}
        </Text>
        <Button
          title={uploaded ? 'Replace file' : 'Upload file'}
          variant="secondary"
          onPress={async () => {
            if (!applicationId) {
              onChange(`pending:${field.key}`);
              return;
            }
            const { uploadProviderDocument } = await import(
              '@/shared/api/providerHooks'
            );
            const placeholder = new Uint8Array([80, 68, 70, 45, 49, 46, 52]);
            await uploadProviderDocument(
              applicationId,
              field.key,
              `${field.key}.pdf`,
              'application/pdf',
              placeholder.buffer,
            );
            onDocumentUploaded?.(field.key);
          }}
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
    const current = String(value ?? field.options[0]?.value ?? '');
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
  const keyboardType =
    field.type === 'number' || field.type === 'currency'
      ? 'numeric'
      : field.type === 'phone'
      ? 'phone-pad'
      : field.type === 'email'
      ? 'email-address'
      : 'default';

  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.textarea,
        {
          color: theme.colors.textPrimary,
          borderColor: theme.colors.borderSoft,
        },
      ]}
      placeholder={field.label}
      placeholderTextColor={theme.colors.textTertiary}
      multiline={multiline}
      keyboardType={keyboardType}
      value={value == null ? '' : String(value)}
      onChangeText={onChange}
    />
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
}: Props) {
  const theme = useTheme();
  const [openSection, setOpenSection] = useState(schema.sections[0]?.id ?? '');

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
          required.length > 0 &&
          required.every(field => hasValue(getValue(values, field.key)));
        const completedCount = fields.filter(field =>
          hasValue(getValue(values, field.key)),
        ).length;
        const details = SECTION_DETAILS[section.id] ?? {
          icon: 'clipboard-list' as IconName,
          description: 'Add the details customers need to know',
        };
        return (
          <View
            key={section.id}
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
              {isComplete ? (
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
                  <View key={field.key} style={styles.field}>
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
                    />
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
});
