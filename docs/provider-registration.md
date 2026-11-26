# Knock provider registration

## Consolidated implementation requirements

Everyone registering as a service provider is a Business. “Become a Service Provider” opens service selection directly, with no Individual/Business step in navigation, progress, or back navigation. The API assigns the type. Resume older drafts with their entered values and selected services intact, including drafts previously marked Individual.

Keep the public listing name and the fields necessary to publish the selected service. Legal business name, registration number, GSTIN, and business registration documents are optional. Label them Optional, offer Skip for now on their section, and allow submission and admin approval when blank. Validate supplied values beside the field. Missing legal values are absent or null; voluntary details remain visible in private admin review.

Provide a Business Location section with address search, manual map placement, and Use my current location. Request device permission only after that action. Permission denial and GPS failure must leave manual search and placement available. Selecting an address moves the pin; moving the pin requests a suggested address. Allow address correction and separate shop number, floor, or landmark details without moving a confirmed pin.

Require Confirm location before accepting coordinates. Never save the default map position as the business location. Persist the address, latitude, longitude, and confirmation state through the API, and restore them when revisiting a draft or saved business. Physical venues and services offered at the provider's location require an address and confirmed pin; home visits and online services may skip location. Legal registration remains optional in either case.

Map and address-search failures must preserve the draft and offer Retry. Explain any missing required pin beside the field. Apply the same flow on iOS and Android.

## Implementation notes

- `packages/contracts/src/provider-registration.ts` applies the same policy to mobile, API readiness, and stored CMS schemas. It preserves service-specific professional qualifications.
- New applications, updates, submissions, reopens, and approvals use Business. Legacy provider-kind inputs are ignored. Existing accounts and application payloads are not reset.
- The registration screen hydrates old payload fields and service selections. Explicit confirmation is required for legacy coordinates that have no confirmation state.
- Legal fields stay in the application for admin review and are excluded from the approved public profile. Public listing name is separate.
- The location editor commits only a confirmed selection. Search/reverse-search requests ignore stale responses, and map retry retains its selection. Shop/floor/landmark is stored separately.
- `apps/api/src/db/migrations/provider-business.sql` sets Business defaults and aligns the existing source-application unique index. Registration values use existing JSON payloads, which have no non-null legal-field constraints. Apply this migration during the normal API release. It has been applied only to the disposable local test database.

## Verification on 2026-11-26

- 80 mobile tests passed across 11 suites. Coverage includes both platform rendering paths, direct service-selection entry, legacy drafts, pin confirmation, manual selection after permission denial, Android approximate location, retry without lost state, and location hydration. Native map and geocoding responses are mocked in these tests.
- 30 API tests passed. Integration coverage includes submission and approval with blank legal fields, conversion of an Individual draft to Business, voluntary legal details in admin review, online services without a pin, rejection of unconfirmed required pins, and reopening an approved business with the saved address and coordinates.
- Contracts build and API/admin type checks passed. Mobile type checking still reports the same 23 pre-existing errors, with no new diagnostics in this change.
- Android release APK and iOS simulator Release compilation passed. These checks are separate from live map operation.

## Remaining native acceptance checks

Live Google Maps/Geocoding checks require authorization to use the configured Google API key. Automatic approval review blocked the attempted live geocoding check. No live map acceptance result is claimed.

On both iOS and Android, after authorization:

1. Tap Become a Service Provider, select a service, and verify there is no provider-type screen when continuing or going back.
2. Leave all legal registration details blank, confirm a physical venue entrance, and submit. Approve and reopen it; compare its address and coordinates.
3. Search an address, select a result, pan/tap to the entrance, and confirm. Add a shop/floor/landmark and verify the pin is unchanged after reopening.
4. Deny location permission and complete the same flow with manual selection. Also exercise unavailable GPS.
5. Interrupt map/search connectivity, retry, and verify other form values and the selected location survive.
6. Resume a legacy Individual draft and verify its entered fields survive and it submits as Business.
7. Enter voluntary valid legal details and verify them in admin review. Enter invalid details and verify adjacent errors.
8. Select an online/home-only service and skip location. Verify a physical venue cannot submit with the default or an unconfirmed pin.
