import type { FormFieldDefinition, ResolvedProviderFormSchema } from './provider.js';

/** A service at a fixed venue needs a customer-facing entrance. Home/online work does not. */
export function requiresBusinessLocation(categoryIds: string[] = [], services: Record<string, unknown> = {}) {
  return services.atLocation === true || categoryIds.some(id =>
    /^(rooms\.|health\.(hospitals|clinic|laboratory|scan|pharmacy)$|fitness\.(gym|crossfit)$|sports\.facility_booking$)/.test(id));
}

export function isBusinessRegistrationField(key: string) {
  // Professional qualifications/licences remain part of the selected service.
  return !/^(medical|nutrition|trainer)\./.test(key) &&
    /(^registration\.|legalbusinessname|legalname|registeredname|gstin|businessregistration|registrationnumber|registrationdocument|companyregistration|incorporation)/i.test(key);
}

export const OPTIONAL_BUSINESS_FIELDS: FormFieldDefinition[] = [
  { key: 'registration.legalBusinessName', type: 'text', label: 'Legal business name', sectionId: 'registration', required: false, validation: { minLength: 2, maxLength: 200 } },
  { key: 'registration.registrationNumber', type: 'text', label: 'Business registration number', sectionId: 'registration', required: false, validation: { minLength: 2, maxLength: 80, pattern: '^[A-Za-z0-9][A-Za-z0-9 ./_-]*$' } },
  { key: 'registration.gstin', type: 'text', label: 'GSTIN', sectionId: 'registration', required: false, validation: { pattern: '^[0-9A-Za-z]{15}$' }, helpText: 'Optional. Enter the 15 letters and numbers if your business has a GSTIN.' },
];

/** Apply to stored CMS schemas too, so old required flags cannot block applicants. */
export function applyProviderRegistrationPolicy(schema: ResolvedProviderFormSchema): ResolvedProviderFormSchema {
  const fields = schema.fields.map(field => {
    if (isBusinessRegistrationField(field.key)) {
      const defaults = /gstin/i.test(field.key) ? OPTIONAL_BUSINESS_FIELDS[2] : /registrationnumber/i.test(field.key) ? OPTIONAL_BUSINESS_FIELDS[1] : /legal.*name|registeredname/i.test(field.key) ? OPTIONAL_BUSINESS_FIELDS[0] : undefined;
      return { ...field, required: false, sectionId: 'registration', validation: { ...defaults?.validation, ...field.validation }, helpText: field.helpText?.replace(/^Required\.?\s*/i, '') };
    }
    if (field.sectionId === 'location' && ['location.map', 'location.address', 'location.city', 'location.pincode'].includes(field.key)) return { ...field, required: requiresBusinessLocation(schema.categoryIds) };
    return field.key === 'basic.providerName' ? { ...field, required: true, label: 'Public listing name' } : field;
  });
  const locationRequired = requiresBusinessLocation(schema.categoryIds);
  const coreFields: FormFieldDefinition[] = [
    { key: 'basic.providerName', type: 'text', label: 'Public listing name', sectionId: 'basic', required: true },
    { key: 'location.address', type: 'textarea', label: 'Business address', sectionId: 'location', required: locationRequired },
    { key: 'location.city', type: 'text', label: 'City', sectionId: 'location', required: locationRequired },
    { key: 'location.pincode', type: 'text', label: 'Pincode', sectionId: 'location', required: locationRequired, validation: { pattern: '^[0-9]{6}$' } },
    { key: 'location.map', type: 'location', label: 'Business Location', sectionId: 'location', required: locationRequired },
  ];
  for (const field of coreFields) if (!fields.some(existing => existing.key === field.key)) fields.push(field);
  for (const field of OPTIONAL_BUSINESS_FIELDS) if (!fields.some(existing => existing.key === field.key)) fields.push(field);
  if (!fields.some(field => field.key === 'location.addressDetails')) fields.push({ key: 'location.addressDetails', type: 'text', label: 'Shop number, floor or landmark', sectionId: 'location', required: false, validation: { maxLength: 300 }, helpText: 'These details do not move your confirmed pin.' });
  const sections = schema.sections.filter(section => section.id !== 'registration');
  if (!sections.some(section => section.id === 'basic')) sections.push({ id: 'basic', title: 'Basic details', sortOrder: 1 });
  if (!sections.some(section => section.id === 'location')) sections.push({ id: 'location', title: 'Business Location', sortOrder: 2 });
  sections.push({ id: 'registration', title: 'Business registration (Optional)', description: 'Add legal business details only if you have them.', sortOrder: 4.5 });
  return { ...schema, sections: sections.sort((a, b) => a.sortOrder - b.sortOrder), fields };
}

export function effectiveLocationFields<T extends { key: string; required?: boolean }>(fields: T[], categoryIds: string[], services: Record<string, unknown>) {
  const required = requiresBusinessLocation(categoryIds, services);
  return fields.map(field => ['location.map', 'location.address', 'location.city', 'location.pincode'].includes(field.key) ? { ...field, required } : field);
}
