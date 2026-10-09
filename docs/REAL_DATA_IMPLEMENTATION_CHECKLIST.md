# Real-data-only implementation checklist

Last audited: 2026-10-08

## Completed in this change set

| Mock source / issue | Replacement | Affected files | API / query | Verification |
|---|---|---|---|---|
| Development Reel/R2 fallback when the feed is empty or API is disabled | API-only merged content/legacy feed; empty feed now remains empty | `apps/mobile/src/shared/api/hooks.ts`, `features/reels/screens/ReelFeedScreen.tsx` | `GET /v1/content/feeds/clip`, `GET /v1/reels` | Static code audit; pending authenticated integration test |
| `dev-` token session bypass and local profile write | Server session/profile only | `shared/services/auth/authService.ts` | `/auth/mobile/me`, `/auth/mobile/profile`, `/auth/mobile/logout` | Mobile TypeScript parse regression repaired; broader typecheck has pre-existing errors |
| Static Shop products/orders and fake order mutations | API-only shop hooks | `shared/api/shopHooks.ts` | `/v1/shop/products`, `/v1/shop/orders` | Static code audit; pending authenticated integration test |
| Full fake Communities/posts/comments store | API-only community hooks | `shared/api/communityHooks.ts` | `/v1/communities` and nested post/comment actions | Static code audit; pending authenticated integration test |
| Notifications silently appearing empty/successful offline | API-only notification and device-token mutations | `shared/api/notificationHooks.ts` | `/v1/notifications`, `/v1/devices` | Static code audit |
| Booking timeline fallback to local booking data and no-op retry | API-only timeline with real empty/error/retry states | `features/booking/components/BookingsTimeline.tsx` | `GET /v1/bookings` | Static code audit |
| Product detail fake product/cart id, image placeholder, seller/rating | API-only product detail | `features/services/screens/ProductDetailScreen.tsx` | `GET /v1/shop/products/:id` | Static code audit |
| Course/trip/enrollment displays falling back to local catalog | API-only detail/list displays | `CourseDetailScreen.tsx`, `MyLearningScreen.tsx`, `MyTripsScreen.tsx` | Courses/trips endpoints | Static code audit |

## Open blockers requiring backend/API implementation or separate screen migration

| Priority | Remaining runtime mock source | Affected feature/files | Required real-data replacement |
|---|---|---|---|
| P1 | `shared/data/mocks` imported directly in health/booking discovery screens | `HomeScreen`, `DoctorsScreen`, `LabListScreen`, `LabDetailScreen`, `DoctorProfileScreen`, `FitnessFeedScreen`, `ClassDetailScreen`, `DiagnosticsHubScreen`, `PhysioHubScreen`, `NeedsScreen`, `HealthScreen` | Establish/verify authenticated provider/service catalog endpoints and replace direct arrays with paginated API hooks, with loading/error/empty states. Do not render the screens from fixtures in production. |
| P1 | Mock Stream conversations/messages and mock notification lists | `ThreadScreen`, `KnockChatList`, `KnockNotificationsList`, `FlashShareSheet`, `FlashPostCard` | Use authenticated Stream channels and real notification/message APIs; show unavailable/error state when credentials/API fail. |
| P1 | Sample media selections and sample Flash/Story publish controls | `FlashComposerScreen`, `StoryCreatorScreen` | Remove sample buttons/data. Upload through media upload session, persist a content draft, then publish only after backend status/visibility validation. |
| P1 | Event Detail still has a local-event fallback and a nonfunctional API booking alert | `EventDetailScreen` | Remove `getEvent` path and wire a real trip-booking form to `POST /v1/trips/trips/:id/book`. |
| P1 | Legacy direct mock booking model | `shared/data/bookings.ts`, `SchedulePicker.tsx` | Replace schedule availability with provider/server slot API. Keep only pure view-model helpers; move fixture data to tests. |
| P2 | Local community/health/service helper models | `shared/data/services.ts`, `shared/data/mocks.ts` | Delete from production imports after each screen is migrated; preserve only isolated test fixtures. |
| P2 | `sample`/`test` editorial Reel contract surface | `packages/contracts/src/reels.ts`, Admin Reels UI | Remove sample/test production publishing options or make the backend reject them on all public feeds. Verify status, moderation, audience, and media-content-record joins server-side. |

## Critical backend/media blockers discovered after the initial audit

### R2 public-origin exposure — **P0 / deployment blocker**

The current R2 custom-domain design can serve `R2_PUBLIC_BASE_URL/<storageKey>` without consulting PostgreSQL. A direct object URL can therefore remain accessible before a content record is published, while it is a draft, or after unpublish/archive/rejection/deletion. API feed filtering is not sufficient to meet the publication requirement.

**Affected implementation:** `apps/api/src/media/R2ObjectStorageProvider.ts`, `apps/api/src/media/MediaService.ts`, R2/Cloudflare deployment configuration.

**Required remediation:**

1. Keep creator uploads and finalized media in a private R2 bucket/origin; never expose a general public custom domain for raw object keys.
2. Add a server/Worker delivery gateway which resolves the media asset against a currently eligible `content_posts` or `reels` record, verifies publication, moderation, author/activity, expiration, audience, and deletion/archive status, then streams the object or returns a short-lived signed URL.
3. Do not create a public-bucket mobile upload session based solely on a requested `visibility` before the content publication transaction succeeds.
4. Revoke/deny delivery immediately when a post/reel is unpublished, rejected, removed, expired, or its asset is archived/deleted.
5. Add integration tests proving direct storage URLs cannot retrieve drafts, rejected/removed assets, or media without a published record.

### Publishing/seed bypasses — **P0 / deployment blocker**

- `apps/api/src/seed/importR2Clips.ts` can enumerate R2 objects and force them to published Reels.
- `apps/api/src/seed/run.ts` persists sample external media/published sample Reels with fake counters.
- Public generic `GET /v1/content/feeds/:format` does not apply the hardened media/author eligibility checks used by the authenticated Clip feed.

**Required remediation:** remove production seed/import commands or gate them behind a non-production environment assertion; route all imports through audited review/publish services; delete or quarantine sample media; make every public format feed use the same eligibility/delivery resolver as Clips.


This machine/session has not supplied valid test accounts, a reachable authenticated PostgreSQL environment, or Cloudflare R2 credentials/media identifiers. Before production acceptance, run and record:

1. Two separate mobile-user sessions (one with a real Business/Provider profile).
2. Real upload to R2 through the application upload session; create a content draft; process; approve/publish; verify visibility as the second user.
3. Audience matrix: public, followers, friends, private; blocks; moderation pending/approved/rejected; removed content; expired Story.
4. Failed network upload, retry/resume, processing failure, and draft recovery after app relaunch.
5. Feed refresh/cursor pagination, profile placement, likes/comments/saves/shares/reports, notifications and cross-user privacy checks.

No R2 object alone is acceptable evidence of publishability; every displayed asset must resolve from a valid published content record under backend visibility rules.
