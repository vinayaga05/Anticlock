export type EventRegistration = {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  educationQualification: string;
};

export type RegistrationErrors = Partial<Record<keyof EventRegistration, 'required' | 'tooLong' | 'mobile'>>;

export const registrationLimits = { firstName: 60, lastName: 60, mobileNumber: 32, educationQualification: 120 } as const;

const singleLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export function normalizeEventRegistration(details: EventRegistration): EventRegistration {
  let mobileNumber = details.mobileNumber.replace(/[\s().-]/g, '');
  if (/^[6-9]\d{9}$/.test(mobileNumber) || /^91[6-9]\d{9}$/.test(mobileNumber)) {
    mobileNumber = mobileNumber.length === 10 ? `+91${mobileNumber}` : `+${mobileNumber}`;
  }

  return {
    firstName: singleLine(details.firstName),
    lastName: singleLine(details.lastName),
    mobileNumber,
    educationQualification: singleLine(details.educationQualification),
  };
}

export function getRegistrationErrors(details: EventRegistration): RegistrationErrors {
  const normalized = normalizeEventRegistration(details);
  const errors: RegistrationErrors = {};

  for (const field of Object.keys(registrationLimits) as (keyof EventRegistration)[]) {
    if (!normalized[field]) errors[field] = 'required';
    else if (details[field].length > registrationLimits[field]) errors[field] = 'tooLong';
  }

  if (!errors.mobileNumber) {
    const validMobile = normalized.mobileNumber.startsWith('+91')
      ? /^\+91[6-9]\d{9}$/.test(normalized.mobileNumber)
      : /^\+[1-9]\d{7,14}$/.test(normalized.mobileNumber);
    if (!validMobile) errors.mobileNumber = 'mobile';
  }

  return errors;
}
