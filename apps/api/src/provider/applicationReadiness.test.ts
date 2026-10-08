import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PROVIDER_REVIEW_TRANSITIONS,
  ProviderApplicationDraftCommonPayloadSchema,
  UpdateProviderApplicationRequestSchema,
  UpdateProviderBusinessRequestSchema,
  allowedReviewActions,
  numberish,
} from '@anticlock/contracts';
import { z } from 'zod';
import { GLOBAL_PROVIDER_FORM_SCHEMA } from '../seed/providerFormSchemas.js';
import { mergeFormSchemas } from './FormSchemaService.js';
import { computeApplicationReadiness } from './applicationReadiness.js';

const schema = mergeFormSchemas(GLOBAL_PROVIDER_FORM_SCHEMA, [], 'business', ['fitness.gym']);

const complete = {
  basic: { providerName: 'Lotus', contactPerson: 'Asha', mobile: '9876543210', email: 'a@b.co' },
  location: { address: '1 Road', city: 'Chennai', pincode: '600020' },
  availability: { workingDays: ['mon'], openingTime: '09:00' },
  services: { pricingStartsAt: 500 },
  profile: {},
};

describe('provider contract number parsing', () => {
  it('coerces numeric strings (with commas) to numbers and empty strings to undefined', () => {
    const parsed = UpdateProviderApplicationRequestSchema.parse({
      commonPayload: {
        services: { pricingStartsAt: '1,500' },
        profile: { yearsInOperation: ' 7 ' },
        location: { serviceRadiusKm: '', latitude: '13.0827', longitude: '80.27' },
      },
    });
    assert.equal(parsed.commonPayload?.services?.pricingStartsAt, 1500);
    assert.equal(parsed.commonPayload?.profile?.yearsInOperation, 7);
    assert.equal(parsed.commonPayload?.location?.serviceRadiusKm, undefined);
    assert.equal(parsed.commonPayload?.location?.latitude, 13.0827);
  });

  it('rejects non-numeric and out-of-range values', () => {
    assert.equal(numberish(z.number()).safeParse('abc').success, false);
    assert.equal(
      ProviderApplicationDraftCommonPayloadSchema.safeParse({ profile: { yearsInOperation: '2.5' } }).success,
      false,
      'years must be an integer',
    );
    assert.equal(
      ProviderApplicationDraftCommonPayloadSchema.safeParse({ services: { pricingStartsAt: -1 } }).success,
      false,
    );
    assert.equal(
      ProviderApplicationDraftCommonPayloadSchema.safeParse({ location: { latitude: '123' } }).success,
      false,
    );
  });

  it('accepts partial drafts (autosave) section by section', () => {
    const parsed = ProviderApplicationDraftCommonPayloadSchema.safeParse({
      basic: { providerName: 'Only name' },
      location: { city: 'Chennai' },
      availability: { workingDays: [] },
    });
    assert.equal(parsed.success, true);
  });

  it('business updates are strict and parse pricing', () => {
    assert.equal(UpdateProviderBusinessRequestSchema.parse({ pricingStartsAt: '900' }).pricingStartsAt, 900);
    assert.equal(UpdateProviderBusinessRequestSchema.safeParse({ name: 'x' }).success, false);
  });
});

describe('provider review state machine', () => {
  it('only allows review actions from submitted / under_review', () => {
    assert.deepEqual(allowedReviewActions('draft'), []);
    assert.deepEqual(allowedReviewActions('submitted'), ['mark_under_review', 'request_info', 'reject']);
    assert.deepEqual(allowedReviewActions('under_review'), ['approve', 'request_info', 'reject']);
    for (const terminal of ['approved', 'rejected', 'more_info_requested'] as const) {
      assert.deepEqual(PROVIDER_REVIEW_TRANSITIONS[terminal], []);
    }
    assert.deepEqual(allowedReviewActions('bogus'), []);
  });
});

describe('computeApplicationReadiness', () => {
  it('is complete when required fields, documents, Aadhaar and service are present', () => {
    const r = computeApplicationReadiness({
      schema,
      commonPayload: complete,
      dynamicPayload: {},
      categoryIds: ['fitness.gym'],
      documentFieldKeys: ['identity.aadhaarDocument', 'identity.idDocument'],
      hasAadhaar: true,
    });
    assert.deepEqual(r.missing, []);
    assert.equal(r.complete, true);
    assert.equal(r.completedCount, r.requiredCount);
  });

  it('lists each missing field, document and invalid value with its section', () => {
    const r = computeApplicationReadiness({
      schema,
      commonPayload: {
        basic: { providerName: 'Lotus', email: 'nope' },
        location: { pincode: '12' },
        services: { pricingStartsAt: 'cheap' },
      },
      dynamicPayload: {},
      categoryIds: [],
      documentFieldKeys: ['identity.idDocument'],
      hasAadhaar: false,
    });
    const by = Object.fromEntries(r.missing.map(m => [m.key, m]));
    assert.equal(r.complete, false);
    assert.equal(by['services.categoryIds']?.reason, 'services');
    assert.equal(by['basic.contactPerson']?.reason, 'required');
    assert.equal(by['basic.contactPerson']?.sectionId, 'basic');
    assert.equal(by['basic.email']?.reason, 'invalid');
    assert.equal(by['location.pincode']?.reason, 'invalid');
    assert.equal(by['services.pricingStartsAt']?.reason, 'invalid');
    assert.equal(by['identity.aadhaarDocument']?.reason, 'document');
    assert.equal(by['identity.aadhaarNumber']?.reason, 'document');
    assert.equal(by['identity.idDocument'], undefined, 'uploaded doc is not missing');
    assert.ok(r.completedCount < r.requiredCount);
  });

  it('reads profile media and map location through their contract aliases', () => {
    const withMedia = mergeFormSchemas(
      {
        ...GLOBAL_PROVIDER_FORM_SCHEMA,
        fields: GLOBAL_PROVIDER_FORM_SCHEMA.fields.map(f =>
          f.key === 'profile.logo' || f.key === 'location.map' ? { ...f, required: true } : f,
        ),
      },
      [],
      'business',
      ['x'],
    );
    const base = {
      schema: withMedia,
      dynamicPayload: {},
      categoryIds: ['x'],
      documentFieldKeys: ['identity.aadhaarDocument', 'identity.idDocument'],
      hasAadhaar: true,
    };
    const missing = computeApplicationReadiness({ ...base, commonPayload: complete });
    assert.deepEqual(missing.missing.map(m => m.key).sort(), ['location.map', 'profile.logo']);
    const ok = computeApplicationReadiness({
      ...base,
      commonPayload: {
        ...complete,
        location: { ...complete.location, latitude: 13.08, longitude: 80.27 },
        profile: { logoMediaId: '9f3f1f3e-5c0f-4f90-9b78-9c95ec2ce994' },
      },
    });
    assert.deepEqual(ok.missing, []);
  });
});
