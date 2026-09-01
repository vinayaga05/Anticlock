'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { FormFieldDefinition, ProviderFormSchema } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'phone',
  'email',
  'dropdown',
  'multiselect',
  'date',
  'time',
  'image',
  'video',
  'document',
  'location',
  'boolean',
  'currency',
  'aadhaar',
] as const;

export default function ProviderFormSchemaEditorPage() {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const [draft, setDraft] = useState<ProviderFormSchema | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'provider', 'form-schemas', params.id],
    queryFn: async () => {
      const res = await apiFetch<{ schema: ProviderFormSchema }>(
        `/admin/provider/form-schemas/${params.id}`,
      );
      setDraft(res.schema);
      return res.schema;
    },
  });

  const save = useMutation({
    mutationFn: (schema: ProviderFormSchema) =>
      apiFetch(`/admin/provider/form-schemas/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          scope: schema.scope,
          categoryId: schema.categoryId,
          providerKinds: schema.providerKinds,
          version: schema.version,
          status: schema.status,
          sections: schema.sections,
          fields: schema.fields,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'provider', 'form-schemas'] });
    },
  });

  const schema = draft ?? data;

  function updateField(index: number, patch: Partial<FormFieldDefinition>) {
    if (!schema) return;
    const fields = schema.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setDraft({ ...schema, fields });
  }

  function addField() {
    if (!schema) return;
    const sectionId = schema.sections[0]?.id ?? 'custom';
    setDraft({
      ...schema,
      fields: [
        ...schema.fields,
        {
          key: `custom.field_${schema.fields.length + 1}`,
          type: 'text',
          label: 'New field',
          sectionId,
          required: false,
        },
      ],
    });
  }

  return (
    <AdminShell>
      <Link href="/provider/form-schemas" className="muted">
        ← Back to schemas
      </Link>
      <h1 className="page-title">Edit form schema</h1>
      {isLoading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{(error as Error).message}</p> : null}
      {schema ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <p>
              <strong>Scope:</strong> {schema.scope}
              {schema.categoryId ? ` · ${schema.categoryId}` : ''}
            </p>
            <p className="muted">Version {schema.version} · {schema.fields.length} fields</p>
          </div>
          <div className="card">
            <h2 className="section-title">Fields</h2>
            {schema.fields.map((field, index) => (
              <div key={`${field.key}-${index}`} className="form-row" style={{ marginBottom: 12 }}>
                <input
                  className="input"
                  value={field.label}
                  onChange={e => updateField(index, { label: e.target.value })}
                />
                <input
                  className="input"
                  value={field.key}
                  onChange={e => updateField(index, { key: e.target.value })}
                />
                <select
                  className="input"
                  value={field.type}
                  onChange={e =>
                    updateField(index, {
                      type: e.target.value as FormFieldDefinition['type'],
                    })
                  }
                >
                  {FIELD_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={e => updateField(index, { required: e.target.checked })}
                  />{' '}
                  Required
                </label>
              </div>
            ))}
            {hasPermission('catalog.write') ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn secondary" onClick={addField}>
                  Add field
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={save.isPending}
                  onClick={() => save.mutate(schema)}
                >
                  {save.isPending ? 'Saving…' : 'Save schema'}
                </button>
              </div>
            ) : null}
            {save.isError ? (
              <p className="error">{(save.error as Error).message}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
