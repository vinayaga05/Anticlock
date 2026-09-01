import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { FormFieldDefinition, ResolvedProviderFormSchema } from '@/features/provider-onboarding/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { Button } from '@/shared/components/Button';

type Props = {
  schema: ResolvedProviderFormSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  aadhaarMasked?: string | null;
  uploadedDocs?: Set<string>;
  applicationId?: string;
  onDocumentUploaded?: (fieldKey: string) => void;
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
    return (
      <Switch value={Boolean(value)} onValueChange={onChange} />
    );
  }

  if (field.type === 'aadhaar') {
    return (
      <TextInput
        style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.borderSoft }]}
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

  if (field.type === 'document' || field.type === 'image' || field.type === 'video') {
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
            const { uploadProviderDocument } = await import('@/shared/api/providerHooks');
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
        { color: theme.colors.textPrimary, borderColor: theme.colors.borderSoft },
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {schema.sections.map(section => {
        const fields = fieldsBySection.get(section.id) ?? [];
        if (!fields.length) return null;
        const isOpen = openSection === section.id;
        return (
          <View
            key={section.id}
            style={[styles.section, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}
          >
            <Button
              title={section.title}
              variant="ghost"
              onPress={() => setOpenSection(isOpen ? '' : section.id)}
            />
            {isOpen
              ? fields.map(field => (
                  <View key={field.key} style={styles.field}>
                    <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Text>
                    {field.helpText ? (
                      <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>
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
                ))
              : null}
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
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  field: {
    marginTop: 8,
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
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
