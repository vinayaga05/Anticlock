import type { ResolvedProviderFormSchema } from '@/features/provider-onboarding/types';
import {
  buildApplicationPayload,
  computeCompletion,
  hydrateFormValues,
  parseNumberInput,
  validateField,
  validateFormValues,
} from '@/features/provider-onboarding/utils/formValues';

const schema: ResolvedProviderFormSchema = {
  sections: [
    { id: 'basic', title: 'Basic', sortOrder: 1 },
    { id: 'location', title: 'Location', sortOrder: 2 },
    { id: 'profile', title: 'Profile', sortOrder: 3 },
    { id: 'identity', title: 'Identity', sortOrder: 4 },
    { id: 'services', title: 'Services', sortOrder: 5 },
    { id: 'gym', title: 'Gym', sortOrder: 6 },
  ],
  fields: [
    {
      key: 'basic.providerName',
      type: 'text',
      label: 'Business name',
      required: true,
      sectionId: 'basic',
    },
    { key: 'basic.email', type: 'email', label: 'Email', sectionId: 'basic' },
    {
      key: 'location.pincode',
      type: 'text',
      label: 'Pincode',
      required: true,
      sectionId: 'location',
      validation: { pattern: '^[0-9]{6}$' },
    },
    {
      key: 'location.map',
      type: 'location',
      label: 'Map pin',
      sectionId: 'location',
    },
    {
      key: 'location.serviceRadiusKm',
      type: 'number',
      label: 'Service radius',
      sectionId: 'location',
    },
    { key: 'profile.logo', type: 'image', label: 'Logo', sectionId: 'profile' },
    {
      key: 'profile.coverImages',
      type: 'image',
      label: 'Cover images',
      sectionId: 'profile',
    },
    {
      key: 'identity.aadhaarNumber',
      type: 'aadhaar',
      label: 'Aadhaar',
      required: true,
      sectionId: 'identity',
    },
    {
      key: 'identity.idDocument',
      type: 'document',
      label: 'ID document',
      required: true,
      sectionId: 'identity',
    },
    {
      key: 'services.pricingStartsAt',
      type: 'currency',
      label: 'Starting price',
      sectionId: 'services',
    },
    { key: 'gym.openedOn', type: 'date', label: 'Opened on', sectionId: 'gym' },
    {
      key: 'gym.capacity',
      type: 'number',
      label: 'Capacity',
      sectionId: 'gym',
      validation: { min: 1 },
    },
  ],
} as ResolvedProviderFormSchema;

describe('parseNumberInput', () => {
  it('parses typed numbers and rejects junk', () => {
    expect(parseNumberInput('1,200')).toBe(1200);
    expect(parseNumberInput(' 450.5 ')).toBe(450.5);
    expect(parseNumberInput('₹ 999')).toBe(999);
    expect(parseNumberInput(12)).toBe(12);
    expect(parseNumberInput('12abc')).toBeNull();
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput(undefined)).toBeNull();
  });
});

describe('buildApplicationPayload', () => {
  it('parses numbers, maps media aliases and location, keeps Aadhaar out of the payload', () => {
    const result = buildApplicationPayload(
      {
        'basic.providerName': '  Lotus Yoga  ',
        'location.pincode': '600017',
        'location.map': { latitude: '13.04', longitude: '80.23' },
        'location.serviceRadiusKm': '12',
        'profile.logo': 'media-logo',
        'profile.coverImages': ['c1', 'c2'],
        'identity.aadhaarNumber': '1234 5678 9012',
        'identity.idDocument': 'ignored',
        'services.pricingStartsAt': '1,499',
        'gym.capacity': '40',
        'gym.openedOn': '2024-02-01',
      },
      schema,
    );
    expect(result.commonPayload).toEqual({
      basic: { providerName: 'Lotus Yoga' },
      location: {
        pincode: '600017',
        latitude: 13.04,
        longitude: 80.23,
        serviceRadiusKm: 12,
      },
      profile: { logoMediaId: 'media-logo', coverMediaIds: ['c1', 'c2'] },
      services: { pricingStartsAt: 1499 },
    });
    expect(result.dynamicPayload).toEqual({
      'gym.capacity': 40,
      'gym.openedOn': '2024-02-01',
    });
    expect(result.aadhaarNumber).toBe('123456789012');
    expect(JSON.stringify(result.commonPayload)).not.toContain('1234');
  });

  it('omits half-typed numbers so an autosave never fails, and clears emptied values', () => {
    const result = buildApplicationPayload(
      {
        'services.pricingStartsAt': '12a',
        'gym.capacity': '',
        'basic.email': '   ',
      },
      schema,
    );
    expect(result.commonPayload.services).toEqual({});
    expect(result.commonPayload.basic).toEqual({});
    expect(result.dynamicPayload).toEqual({ 'gym.capacity': null });
    expect(result.aadhaarNumber).toBeUndefined();
  });

  it('keeps the last saved number while a value is half-typed', () => {
    const saved = {
      commonPayload: {
        services: { pricingStartsAt: 1500 },
        location: { latitude: 13.04, longitude: 80.23, serviceRadiusKm: 8 },
      },
    } as never;
    const result = buildApplicationPayload(
      {
        'services.pricingStartsAt': '1500.',
        'location.map': { latitude: '13.', longitude: '-' },
        'location.serviceRadiusKm': '-',
        'gym.capacity': '4x',
      },
      schema,
      saved,
    );
    expect(result.commonPayload.services).toEqual({ pricingStartsAt: 1500 });
    expect(result.commonPayload.location).toEqual({
      latitude: 13.04,
      longitude: 80.23,
      serviceRadiusKm: 8,
    });
    // Dynamic keys merge individually on the API, so an unsent key is kept.
    expect(result.dynamicPayload).toEqual({});

    // A deliberately emptied value is still cleared.
    const cleared = buildApplicationPayload(
      { 'services.pricingStartsAt': '', 'location.map': { latitude: '', longitude: '' } },
      schema,
      saved,
    );
    expect(cleared.commonPayload.services).toEqual({});
    expect(cleared.commonPayload.location).toEqual({});
  });
});

describe('hydrateFormValues', () => {
  it('reverses aliases, location and numbers for editing', () => {
    const values = hydrateFormValues(
      {
        commonPayload: {
          basic: { providerName: 'Lotus' },
          location: { latitude: 13.04, longitude: 80.23, serviceRadiusKm: 12 },
          profile: { logoMediaId: 'media-logo', coverMediaIds: ['c1'] },
        },
        dynamicPayload: { 'gym.capacity': 40 },
      },
      schema,
    );
    expect(values['profile.logo']).toBe('media-logo');
    expect(values['profile.coverImages']).toEqual(['c1']);
    expect(values['location.map']).toEqual({
      latitude: '13.04',
      longitude: '80.23',
    });
    expect(values['location.serviceRadiusKm']).toBe('12');
    expect(values['gym.capacity']).toBe('40');
  });
});

describe('validation', () => {
  const field = (key: string) => schema.fields.find(f => f.key === key)!;
  it('flags field-level problems', () => {
    expect(validateField(field('basic.providerName'), '')).toBe(
      'Business name is required',
    );
    expect(validateField(field('basic.email'), 'nope')).toBe(
      'Enter a valid email address',
    );
    expect(validateField(field('location.pincode'), '6000')).toBe(
      'Enter a valid pincode',
    );
    expect(validateField(field('gym.capacity'), '0')).toBe(
      'Capacity must be at least 1',
    );
    expect(validateField(field('services.pricingStartsAt'), 'abc')).toBe(
      'Starting price must be a number',
    );
    expect(
      validateField(field('location.map'), { latitude: '200', longitude: '1' }),
    ).toBe('Enter a valid latitude and longitude');
    expect(validateField(field('identity.aadhaarNumber'), '1234')).toBe(
      'Aadhaar must be 12 digits',
    );
    expect(
      validateField(field('identity.aadhaarNumber'), '', {
        aadhaarSaved: true,
      }),
    ).toBeNull();
    expect(validateField(field('identity.idDocument'), undefined)).toBe(
      'Upload id document',
    );
    expect(
      validateField(field('identity.idDocument'), undefined, {
        hasDocument: true,
      }),
    ).toBeNull();
  });

  it('computes required completion including documents', () => {
    const values = {
      'basic.providerName': 'Lotus',
      'location.pincode': '600017',
    };
    expect(computeCompletion(schema, values).done).toBe(2);
    const full = computeCompletion(schema, values, {
      documentKeys: ['identity.idDocument'],
      aadhaarSaved: true,
    });
    expect(full).toMatchObject({ required: 4, done: 4 });
    expect(
      validateFormValues(schema, { ...values, 'basic.email': 'x' })[
        'basic.email'
      ],
    ).toBeTruthy();
  });
});
