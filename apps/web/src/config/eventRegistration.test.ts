import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventPayment, getEmailProofLink, getPaymentProofMessage, getUpiPaymentLink, getWhatsAppProofLink } from './event';
import { getRegistrationErrors, normalizeEventRegistration, type EventRegistration } from './eventRegistration';

const participant: EventRegistration = {
  firstName: 'அருண்',
  lastName: "O'Neil",
  mobileNumber: '9876543210',
  educationQualification: 'B.Sc. Physical Education',
};

test('requires all four participant details, including whitespace-only values', () => {
  assert.deepEqual(getRegistrationErrors({ firstName: ' ', lastName: '', mobileNumber: ' ', educationQualification: '\n' }), {
    firstName: 'required', lastName: 'required', mobileNumber: 'required', educationQualification: 'required',
  });
});

test('supports Unicode names, initials and punctuation without English-only validation', () => {
  assert.deepEqual(getRegistrationErrors(participant), {});
  assert.deepEqual(normalizeEventRegistration({ ...participant, firstName: '  அருண்   குமார் ', lastName: ' R. ' }), {
    ...participant, firstName: 'அருண் குமார்', lastName: 'R.', mobileNumber: '+919876543210',
  });
});

test('normalizes Indian mobile formats to an explicit country code', () => {
  for (const mobileNumber of ['9876543210', '+91 98765 43210', '919876543210', '(+91) 98765-43210']) {
    assert.deepEqual(getRegistrationErrors({ ...participant, mobileNumber }), {});
    assert.equal(normalizeEventRegistration({ ...participant, mobileNumber }).mobileNumber, '+919876543210');
  }
});

test('accepts international mobiles with explicit country code and rejects invalid numbers', () => {
  assert.deepEqual(getRegistrationErrors({ ...participant, mobileNumber: '+44 7700 900123' }), {});
  for (const mobileNumber of ['123', 'phone', '+91 12345 67890', '+91 98765', '447700900123', '+1234567890123456', '98765/43210']) {
    assert.equal(getRegistrationErrors({ ...participant, mobileNumber }).mobileNumber, 'mobile');
  }
});

test('enforces sensible length limits on participant fields', () => {
  assert.deepEqual(getRegistrationErrors({ ...participant, firstName: 'a'.repeat(61), lastName: 'b'.repeat(61), educationQualification: 'c'.repeat(121) }), {
    firstName: 'tooLong', lastName: 'tooLong', educationQualification: 'tooLong',
  });
});

test('proof messages include normalized details and keep single-line fields on one line', () => {
  const message = getPaymentProofMessage({ ...participant, firstName: 'அருண்\nInjected label: value', educationQualification: 'B.Sc.\r\n& Coaching' });
  assert.ok(message.includes('First name / முதல் பெயர்: அருண் Injected label: value'));
  assert.ok(message.includes('Mobile number / கைபேசி எண்: +919876543210'));
  assert.ok(message.includes('Education qualification / கல்வித் தகுதி: B.Sc. & Coaching'));
  assert.ok(message.includes('[add transaction ID]'));
  assert.ok(!message.includes('I have attached'));
});

test('proof links encode all participant details and stay disabled without configured contacts', () => {
  const original = { ...eventPayment };
  try {
    eventPayment.whatsappNumber = '';
    eventPayment.email = '';
    assert.equal(getWhatsAppProofLink(participant), '');
    assert.equal(getEmailProofLink(participant), '');
    eventPayment.whatsappNumber = '+91 00000 00000';
    eventPayment.email = 'events@example.invalid';
    const details = { ...participant, educationQualification: 'B.Sc. & M.Sc. #1 + Coaching' };
    const expected = getPaymentProofMessage(details);
    assert.equal(new URL(getWhatsAppProofLink(details)).searchParams.get('text'), expected);
    const email = new URL(getEmailProofLink(details));
    assert.equal(email.pathname, 'events@example.invalid');
    assert.equal(email.searchParams.get('body'), expected);
  } finally {
    Object.assign(eventPayment, original);
  }
});

test('attendee details are never placed in the UPI payment note', () => {
  const original = eventPayment.upiId;
  try {
    eventPayment.upiId = 'demo@example';
    const payment = new URL(getUpiPaymentLink());
    assert.equal(payment.searchParams.get('am'), '500');
    assert.ok(!payment.searchParams.get('tn')?.includes(participant.firstName));
    assert.ok(!payment.searchParams.get('tn')?.includes(participant.mobileNumber));
  } finally {
    eventPayment.upiId = original;
  }
});
