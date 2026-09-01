import type {
  FormFieldDefinition,
  FormSection,
  ProviderFormSchemaBody,
  ProviderKind,
  ResolvedProviderFormSchema,
} from '@anticlock/contracts';
import { eq, inArray, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { providerFormSchemas } from '../db/schema.js';

function fieldVisible(field: FormFieldDefinition, providerKind: ProviderKind) {
  if (!field.visibleWhen?.providerKind) return true;
  return field.visibleWhen.providerKind === providerKind;
}

export function mergeFormSchemas(
  globalSchema: ProviderFormSchemaBody,
  categorySchemas: ProviderFormSchemaBody[],
  providerKind: ProviderKind,
  categoryIds: string[],
): ResolvedProviderFormSchema {
  const sectionMap = new Map<string, FormSection>();
  const fieldMap = new Map<string, FormFieldDefinition>();

  for (const section of globalSchema.sections) {
    sectionMap.set(section.id, section);
  }
  for (const field of globalSchema.fields) {
    if (fieldVisible(field, providerKind)) {
      fieldMap.set(field.key, field);
    }
  }

  for (const schema of categorySchemas) {
    for (const section of schema.sections) {
      if (!sectionMap.has(section.id)) {
        sectionMap.set(section.id, section);
      }
    }
    for (const field of schema.fields) {
      if (fieldVisible(field, providerKind)) {
        fieldMap.set(field.key, field);
      }
    }
  }

  const sections = Array.from(sectionMap.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const fields = Array.from(fieldMap.values());

  return { sections, fields, categoryIds };
}

export async function loadPublishedSchemas(categoryIds: string[]) {
  const [globalRow] = await db
    .select()
    .from(providerFormSchemas)
    .where(
      and(
        eq(providerFormSchemas.scope, 'global'),
        eq(providerFormSchemas.status, 'published'),
      ),
    )
    .limit(1);

  const categoryRows =
    categoryIds.length > 0
      ? await db
          .select()
          .from(providerFormSchemas)
          .where(
            and(
              eq(providerFormSchemas.scope, 'category'),
              eq(providerFormSchemas.status, 'published'),
              inArray(providerFormSchemas.categoryId, categoryIds),
            ),
          )
      : [];

  return {
    global: globalRow
      ? ({
          scope: 'global' as const,
          providerKinds: globalRow.providerKinds as ProviderKind[],
          version: globalRow.version,
          status: globalRow.status as 'published',
          sections: globalRow.sections as FormSection[],
          fields: globalRow.fields as FormFieldDefinition[],
        } satisfies ProviderFormSchemaBody)
      : null,
    categories: categoryRows.map(row => ({
      scope: 'category' as const,
      categoryId: row.categoryId ?? undefined,
      providerKinds: row.providerKinds as ProviderKind[],
      version: row.version,
      status: row.status as 'published',
      sections: row.sections as FormSection[],
      fields: row.fields as FormFieldDefinition[],
    })) satisfies ProviderFormSchemaBody[],
  };
}

export async function resolveFormSchema(
  providerKind: ProviderKind,
  categoryIds: string[],
): Promise<ResolvedProviderFormSchema> {
  const { global, categories } = await loadPublishedSchemas(categoryIds);
  if (!global) {
    throw Object.assign(new Error('Global provider form schema is not configured'), {
      code: 'schema_missing',
      status: 500,
    });
  }
  if (!global.providerKinds.includes(providerKind)) {
    throw Object.assign(new Error('Provider kind is not supported'), {
      code: 'invalid_provider_kind',
      status: 400,
    });
  }
  return mergeFormSchemas(global, categories, providerKind, categoryIds);
}

export function validateDynamicPayload(
  schema: ResolvedProviderFormSchema,
  dynamicPayload: Record<string, unknown>,
  commonPayload: Record<string, unknown>,
) {
  const errors: string[] = [];
  const allValues = { ...flattenPayload(commonPayload), ...dynamicPayload };

  for (const field of schema.fields) {
    if (!field.required) continue;
    const value = allValues[field.key];
    if (value === undefined || value === null || value === '') {
      errors.push(`${field.label} is required`);
    }
  }

  if (errors.length) {
    throw Object.assign(new Error(errors.join('; ')), {
      code: 'validation_error',
      status: 400,
      details: errors,
    });
  }
}

function flattenPayload(payload: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenPayload(value as Record<string, unknown>, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

export function mapSchemaRow(row: typeof providerFormSchemas.$inferSelect) {
  return {
    id: row.id,
    scope: row.scope as ProviderFormSchemaBody['scope'],
    categoryId: row.categoryId ?? undefined,
    providerKinds: row.providerKinds as ProviderKind[],
    version: row.version,
    status: row.status as ProviderFormSchemaBody['status'],
    sections: row.sections as FormSection[],
    fields: row.fields as FormFieldDefinition[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
