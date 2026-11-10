import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CreateExploreEventRequestSchema,
  CreateUserProductRequestSchema,
  ExploreReviewRequestSchema,
} from '@anticlock/contracts';

const PROFILE = '3ecdda28-0747-4357-aa2c-6c2e67f6e861';
const CATEGORY = '5ce8f64d-0747-4357-aa2c-6c2e67f6e862';
const MEDIA = '7ce8f64d-0747-4357-aa2c-6c2e67f6e863';

describe('Explore submission contracts', () => {
  it('accepts a complete event and rejects an end before its start', () => {
    const event = {
      publisherProfileId: PROFILE,
      publisherProfileType: 'personal',
      title: 'Sunday run',
      description: 'A community run for all levels.',
      categoryId: 'running',
      tags: ['running'],
      startsAt: '2027-01-01T08:00:00.000Z',
      endsAt: '2027-01-01T09:00:00.000Z',
      timezone: 'Asia/Kolkata',
      venueType: 'physical',
      location: { name: 'Marina Beach', address: 'Marina Beach, Chennai' },
      onlineUrl: null,
      ticketType: 'free',
      capacity: 50,
      price: 0,
      currency: 'INR',
      contact: { name: 'Arun', phone: '9876543210' },
      requestedVisibility: 'public',
      mediaIds: [MEDIA],
    };
    assert.equal(CreateExploreEventRequestSchema.safeParse(event).success, true);
    assert.equal(CreateExploreEventRequestSchema.safeParse({
      ...event,
      endsAt: '2027-01-01T07:00:00.000Z',
    }).success, false);
  });

  it('rejects invalid paid events and incomplete online venues', () => {
    const base = {
      title: 'Workshop', description: 'Hands-on workshop', categoryId: 'events', tags: [],
      startsAt: '2027-01-01T08:00:00.000Z', endsAt: '2027-01-01T09:00:00.000Z',
      timezone: 'Asia/Kolkata', capacity: 20, currency: 'INR',
      contact: { name: 'Host', email: 'host@example.com' }, requestedVisibility: 'followers_only',
      mediaIds: [MEDIA],
    };
    assert.equal(CreateExploreEventRequestSchema.safeParse({
      ...base, venueType: 'online', onlineUrl: null, ticketType: 'paid', price: 0,
    }).success, false);
  });

  it('validates product stock, media, pickup details, discounts, and contact', () => {
    const product = {
      publisherProfileId: PROFILE,
      publisherProfileType: 'personal',
      categoryId: CATEGORY,
      name: 'Resistance bands',
      description: 'Five-band set',
      price: 100_00,
      compareAtPrice: 120_00,
      inventory: 5,
      imageIds: [MEDIA],
      tags: ['fitness'],
      requestedVisibility: 'public',
      deliveryMethods: ['pickup'],
      pickupDetails: 'Collect at the studio',
      contact: { name: 'Seller', phone: '9876543210' },
    };
    assert.equal(CreateUserProductRequestSchema.safeParse(product).success, true);
    assert.equal(CreateUserProductRequestSchema.safeParse({
      ...product, compareAtPrice: 50_00, inventory: -1, pickupDetails: null,
    }).success, false);
  });

  it('requires reasons for adverse review actions', () => {
    assert.equal(ExploreReviewRequestSchema.safeParse({ action: 'approve' }).success, true);
    assert.equal(ExploreReviewRequestSchema.safeParse({ action: 'request_changes' }).success, false);
    assert.equal(ExploreReviewRequestSchema.safeParse({ action: 'reject', reason: 'Duplicate' }).success, true);
    assert.equal(ExploreReviewRequestSchema.safeParse({ action: 'suspend' }).success, false);
  });
});
