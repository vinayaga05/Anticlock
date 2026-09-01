import type {
  FormFieldDefinition,
  FormSection,
  ProviderKind,
  ResolvedProviderFormSchema,
} from './types';

type LocalSchema = {
  categoryId?: string;
  providerKinds: ProviderKind[];
  sections: FormSection[];
  fields: FormFieldDefinition[];
};

const GLOBAL_SCHEMA: LocalSchema = {
  providerKinds: ['business', 'individual'],
  sections: [
    { id: 'basic', title: 'Basic details', sortOrder: 1 },
    { id: 'location', title: 'Location', sortOrder: 2 },
    { id: 'profile', title: 'Profile', sortOrder: 3 },
    { id: 'identity', title: 'Identity & verification', sortOrder: 4 },
    { id: 'availability', title: 'Availability', sortOrder: 5 },
    { id: 'services', title: 'Services offered', sortOrder: 6 },
  ],
  fields: [
    { key: 'basic.providerName', type: 'text', label: 'Business / provider name', required: true, sectionId: 'basic' },
    { key: 'basic.contactPerson', type: 'text', label: 'Contact person', required: true, sectionId: 'basic' },
    { key: 'basic.mobile', type: 'phone', label: 'Mobile number', required: true, sectionId: 'basic' },
    { key: 'basic.email', type: 'email', label: 'Email', required: true, sectionId: 'basic' },
    { key: 'location.address', type: 'textarea', label: 'Address', required: true, sectionId: 'location' },
    { key: 'location.area', type: 'text', label: 'Area / locality', sectionId: 'location' },
    { key: 'location.city', type: 'text', label: 'City', required: true, sectionId: 'location' },
    { key: 'location.pincode', type: 'text', label: 'Pincode', required: true, sectionId: 'location' },
    { key: 'location.map', type: 'location', label: 'Map location', sectionId: 'location' },
    { key: 'location.serviceRadiusKm', type: 'number', label: 'Service radius (km)', sectionId: 'location' },
    { key: 'profile.logo', type: 'image', label: 'Logo / profile image', sectionId: 'profile' },
    { key: 'profile.coverImages', type: 'image', label: 'Cover images', sectionId: 'profile' },
    { key: 'profile.introVideo', type: 'video', label: 'Introduction video', sectionId: 'profile' },
    { key: 'profile.description', type: 'textarea', label: 'Description', sectionId: 'profile' },
    { key: 'profile.yearsInOperation', type: 'number', label: 'Years in operation', sectionId: 'profile' },
    { key: 'identity.aadhaarNumber', type: 'aadhaar', label: 'Aadhaar number', required: true, sectionId: 'identity' },
    { key: 'identity.aadhaarDocument', type: 'document', label: 'Aadhaar document', required: true, sectionId: 'identity' },
    { key: 'identity.idDocument', type: 'document', label: 'Identity document', required: true, sectionId: 'identity' },
    { key: 'identity.businessRegistration', type: 'document', label: 'Business registration', sectionId: 'identity' },
    {
      key: 'availability.workingDays',
      type: 'multiselect',
      label: 'Working days',
      required: true,
      sectionId: 'availability',
      options: [
        { value: 'mon', label: 'Monday' },
        { value: 'tue', label: 'Tuesday' },
        { value: 'wed', label: 'Wednesday' },
        { value: 'thu', label: 'Thursday' },
        { value: 'fri', label: 'Friday' },
        { value: 'sat', label: 'Saturday' },
        { value: 'sun', label: 'Sunday' },
      ],
    },
    { key: 'availability.openingTime', type: 'time', label: 'Opening time', sectionId: 'availability' },
    { key: 'availability.closingTime', type: 'time', label: 'Closing time', sectionId: 'availability' },
    { key: 'services.pricingStartsAt', type: 'currency', label: 'Pricing starts at', sectionId: 'services' },
    { key: 'services.atLocation', type: 'boolean', label: 'At-location service', sectionId: 'services' },
    { key: 'services.homeVisit', type: 'boolean', label: 'Home visit available', sectionId: 'services' },
    { key: 'services.online', type: 'boolean', label: 'Online service available', sectionId: 'services' },
  ],
};

const CATEGORY_SCHEMAS: LocalSchema[] = [
  {
    categoryId: 'health.hospitals',
    providerKinds: ['business'],
    sections: [{ id: 'hospital', title: 'Hospital / clinic details', sortOrder: 10 }],
    fields: [
      { key: 'hospital.registrationNumber', type: 'text', label: 'Hospital registration number', required: true, sectionId: 'hospital' },
      { key: 'hospital.departments', type: 'multiselect', label: 'Departments', sectionId: 'hospital', options: [
        { value: 'emergency', label: 'Emergency' },
        { value: 'icu', label: 'ICU' },
        { value: 'opd', label: 'OPD' },
      ]},
      { key: 'hospital.emergencyAvailable', type: 'boolean', label: '24/7 emergency available', sectionId: 'hospital' },
      { key: 'hospital.consultationFee', type: 'currency', label: 'Consultation fee from', sectionId: 'hospital' },
    ],
  },
  {
    categoryId: 'health.doctors',
    providerKinds: ['individual'],
    sections: [{ id: 'medical', title: 'Medical professional', sortOrder: 10 }],
    fields: [
      { key: 'medical.qualification', type: 'text', label: 'Qualification', required: true, sectionId: 'medical' },
      { key: 'medical.registrationNumber', type: 'text', label: 'Medical registration number', required: true, sectionId: 'medical' },
      { key: 'medical.speciality', type: 'text', label: 'Speciality', required: true, sectionId: 'medical' },
      { key: 'medical.consultationFee', type: 'currency', label: 'Consultation fee', sectionId: 'medical' },
    ],
  },
  {
    categoryId: 'health.physiotherapist',
    providerKinds: ['individual'],
    sections: [{ id: 'medical', title: 'Physiotherapy', sortOrder: 10 }],
    fields: [
      { key: 'medical.qualification', type: 'text', label: 'Qualification', required: true, sectionId: 'medical' },
      { key: 'medical.sessionFee', type: 'currency', label: 'Session fee', sectionId: 'medical' },
    ],
  },
  {
    categoryId: 'health.nursing',
    providerKinds: ['individual'],
    sections: [{ id: 'medical', title: 'Nursing services', sortOrder: 10 }],
    fields: [
      { key: 'medical.qualification', type: 'text', label: 'Qualification', required: true, sectionId: 'medical' },
      { key: 'medical.shiftRate', type: 'currency', label: 'Shift rate from', sectionId: 'medical' },
    ],
  },
  {
    categoryId: 'fitness.gym',
    providerKinds: ['business'],
    sections: [{ id: 'gym', title: 'Gym details', sortOrder: 10 }],
    fields: [
      { key: 'gym.equipment', type: 'textarea', label: 'Equipment & facilities', sectionId: 'gym' },
      { key: 'gym.membershipPlans', type: 'textarea', label: 'Membership plans', sectionId: 'gym' },
    ],
  },
  {
    categoryId: 'fitness.personal_trainer',
    providerKinds: ['individual'],
    sections: [{ id: 'trainer', title: 'Personal training', sortOrder: 10 }],
    fields: [
      { key: 'trainer.certifications', type: 'textarea', label: 'Certifications', required: true, sectionId: 'trainer' },
      { key: 'trainer.packages', type: 'textarea', label: 'Training packages & pricing', sectionId: 'trainer' },
    ],
  },
  {
    categoryId: 'course.school_tuition',
    providerKinds: ['individual'],
    sections: [{ id: 'coaching', title: 'Coaching / tutoring', sortOrder: 10 }],
    fields: [
      { key: 'coaching.subject', type: 'text', label: 'Subject or coaching type', required: true, sectionId: 'coaching' },
      { key: 'coaching.feeStructure', type: 'textarea', label: 'Fee structure', sectionId: 'coaching' },
    ],
  },
  {
    categoryId: 'home.electrician',
    providerKinds: ['business', 'individual'],
    sections: [{ id: 'homeservice', title: 'Home service business', sortOrder: 10 }],
    fields: [
      { key: 'homeservice.serviceAreas', type: 'textarea', label: 'Service areas', required: true, sectionId: 'homeservice' },
      { key: 'homeservice.minimumCharge', type: 'currency', label: 'Minimum charge', sectionId: 'homeservice' },
    ],
  },
  {
    categoryId: 'course.homemade',
    providerKinds: ['business', 'individual'],
    sections: [{ id: 'food', title: 'Food provider', sortOrder: 10 }],
    fields: [
      { key: 'food.menuDescription', type: 'textarea', label: 'Menu description', required: true, sectionId: 'food' },
      { key: 'food.mealPeriods', type: 'multiselect', label: 'Meal periods', sectionId: 'food', options: [
        { value: 'breakfast', label: 'Breakfast' },
        { value: 'lunch', label: 'Lunch' },
        { value: 'dinner', label: 'Dinner' },
      ]},
    ],
  },
];

function fieldVisible(field: FormFieldDefinition, providerKind: ProviderKind) {
  if (field.key === 'identity.businessRegistration') {
    return providerKind === 'business';
  }
  return true;
}

export function resolveLocalFormSchema(
  providerKind: ProviderKind,
  categoryIds: string[],
): ResolvedProviderFormSchema {
  const sectionMap = new Map<string, FormSection>();
  const fieldMap = new Map<string, FormFieldDefinition>();

  for (const section of GLOBAL_SCHEMA.sections) sectionMap.set(section.id, section);
  for (const field of GLOBAL_SCHEMA.fields) {
    if (fieldVisible(field, providerKind)) fieldMap.set(field.key, field);
  }

  for (const schema of CATEGORY_SCHEMAS) {
    if (!schema.categoryId || !categoryIds.includes(schema.categoryId)) continue;
    if (!schema.providerKinds.includes(providerKind)) continue;
    for (const section of schema.sections) {
      if (!sectionMap.has(section.id)) sectionMap.set(section.id, section);
    }
    for (const field of schema.fields) fieldMap.set(field.key, field);
  }

  return {
    sections: Array.from(sectionMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
    fields: Array.from(fieldMap.values()),
    categoryIds,
  };
}
