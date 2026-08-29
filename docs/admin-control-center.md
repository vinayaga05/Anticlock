# Anticlock Admin Control Center

The Admin Panel is the system of record for the content, availability, commerce,
and safety decisions reflected in the mobile app. Storage systems (including R2)
hold files; they are never a publishing authority.

## Authority model

```text
Admin action → authenticated Admin API → PostgreSQL domain state
                                      ↘ audit log
Mobile app  ← public, policy-filtered API projection
R2          ← file bytes only (not a feed or publishing system)
```

Every public mobile endpoint must select only an explicit published domain state.
Clients must not infer eligibility from an object URL, bucket listing, asset upload
state, or a locally cached fixture.

## First delivered vertical slice: media and Reels

The Reel workflow is intentionally split into two independent records:

1. A Media Asset describes the stored file: storage key, MIME type, size,
   duration, processing state, moderation state, access, and usages.
2. A Reel describes the user-facing content: caption, creator attribution,
   visibility, lifecycle state, moderation decisions, and aggregate analytics.

The state transition is:

```text
R2 staging upload → Media ready → Reel draft → Reel in review → Reel published
                                                    ↘ rejected / archived
```

Creating or completing an upload can only change the Media Asset. It cannot
create, review, or publish a Reel. A ready asset may be reused by multiple
eligible draft Reels. The publish action is permission-gated, auditable, and
revalidates video readiness, type, duration, and delivery before exposing a
Reel to the public API.

Editorial mode is separate from lifecycle: Reels can be marked standard,
sample, or test. Test Reels are deliberately ineligible for publishing and are
also excluded defensively by the public-feed query.

Reports and moderator actions are database records, rather than flags held in a
browser. The Admin queue is the source of truth for whether an item remains in
review, is rejected, or may be published. Reel engagement events are aggregated
server-side for Admin reporting; they do not grant a mobile client authority to
modify publication state.

Moderators can also approve, hold, or reject the underlying ready Media Asset.
An asset on hold or rejected is excluded from every public Reel that reuses it;
clearing the asset alone does not republish an individually restricted Reel.

## Control-center domains

The remaining Admin areas should follow the same structure: a dedicated domain
model, protected Admin commands, an immutable audit trail, and a minimal public
or provider-facing projection where needed.

| Domain | System of record | Public/projection responsibility |
| --- | --- | --- |
| Dashboard & analytics | aggregate metrics and reporting views | read-only operational summaries |
| Media, Reels, Flash & Stories | media assets plus content lifecycle/moderation records | published, deliverable content only |
| Services, categories & promotions | catalog, pricing and placement rules | current published catalog/home configuration |
| Providers & vendors | profiles, verification, coverage, availability and payout state | approved discovery/booking availability |
| Shop, orders & finance | products, inventory, orders, payments, refunds and ledgers | purchasable inventory and customer order history |
| Bookings & needs | requests, schedules, assignments and status history | authorised customer/provider views |
| Communities & courses/events | membership, roles, sessions, registrations and moderation | policy-filtered community/event views |
| Users, notifications & configuration | account state, campaigns, feature flags and app requirements | scoped notifications and safe runtime configuration |
| Roles & audit | role grants, permissions and append-only action history | no mobile exposure except user-specific policy effects |

## Delivery order

1. Complete Media Library and Reels (lifecycle, moderation, reports and
   engagement analytics).
2. Add Flash/Feed and Stories using the same content, media-usage, moderation,
   and lifecycle primitives.
3. Replace the current domain placeholders with provider, booking, catalog,
   community, commerce, and finance modules in dependency order.
4. Add Dashboard aggregates only after each operational domain emits auditable
   events, so the dashboard reports real source-of-truth data.

## Security boundaries

- R2 credentials remain backend-only. Browsers receive short-lived, scoped PUT
  URLs rather than long-lived keys.
- A browser upload URL targets a staging key; the backend validates and
  promotes it to the asset's final key.
- Publication, moderation, media deletion, refunds, and role changes require
  distinct permissions and audit entries.
- A public R2 delivery URL does not imply publication. If unreleased file
  confidentiality is required, use private delivery or promotion into a public
  namespace only when publishing.
