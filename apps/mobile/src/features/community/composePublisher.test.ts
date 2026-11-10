import { resolveComposePublisher } from './composePublisher';

const personal = { id: 'personal', type: 'user' as const, name: 'Me', avatarUrl: null };
const business = { id: 'business', type: 'provider' as const, name: 'Studio', avatarUrl: null, role: 'owner' };
const secondBusiness = { ...business, id: 'second-business', name: 'Second studio' };
const identities = [personal, business, secondBusiness];

describe('product composer publisher selection', () => {
  it('starts with the active profile for a general create entry', () => {
    expect(resolveComposePublisher(identities, business, null)).toBe(business);
  });

  it('uses the business opened from its profile even when personal is active', () => {
    expect(resolveComposePublisher(identities, personal, { id: business.id, type: 'business' })).toBe(business);
  });

  it('keeps the chosen business when another business becomes globally active', () => {
    expect(resolveComposePublisher(identities, secondBusiness, { id: business.id, type: 'business' })).toBe(business);
  });

  it('does not fall back to another identity if the chosen business is unavailable', () => {
    expect(resolveComposePublisher([personal], personal, { id: business.id, type: 'business' })).toBeNull();
    expect(resolveComposePublisher([], null, { id: business.id, type: 'business' })).toBeNull();
  });

  it('matches profile type and refuses a read-only business role', () => {
    expect(resolveComposePublisher(identities, personal, { id: personal.id, type: 'business' })).toBeNull();
    const analyst = { ...business, role: 'analyst' };
    expect(resolveComposePublisher([personal, analyst], analyst, null)).toBeNull();
  });
});
