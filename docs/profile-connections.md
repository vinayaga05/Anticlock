# Profile followers, following and privacy

## Mobile flow

Followers and Following counts on personal/publisher profiles and business
storefronts open `ProfileConnections` for the displayed profile, independently
of the viewer's active personal/business identity. The list offers profile
navigation, Follow/Following/Requested actions, owner-only follower removal,
and owner-only pending-request review. It uses cursor pagination, refresh,
retry, duplicate suppression and per-row mutation locks.

Personal profiles now have an optional unique lowercase username, edited in
Edit Profile (3–30 ASCII letters, digits or underscores). Existing accounts
without a username show their profile type rather than an invented handle.

## API and storage

- `GET /v1/profile-follows/connections/:type/:id/:direction` accepts `limit`
  (1–100), UUID `cursor`, and an authenticated, owned viewer identity. The
  `data` object contains `items`, `nextCursor`, `counts`, and `isOwner`.
- Each item contains a public publisher identity, viewer-specific relationship,
  and server-derived `canRemove`. Only accepted connections are included.
- `DELETE /v1/profile-follows/followers/:type/:id` removes the follower named in
  its JSON profile reference; the authenticated account must manage the target.
- Existing follow/unfollow, request accept/reject, blocks and privacy endpoints
  retain their authentication and ownership rules.
- Profile advisory locks coordinate follow, block, request and privacy writes;
  repeated follows never downgrade an accepted private relationship.
- Counts exclude inactive/deleted profiles. Pending request counts are private
  to the owner. Blocking removes both directed relationships.
- The migration adds nullable `mobile_users.handle` and a unique index.

## Visibility policy

Public accounts accept follows immediately. Private accounts require approval;
pending requests grant neither follower counts nor content/list access. Owners
can accept/decline; requesters can cancel. Unfollowing or removal revokes access.
Changing a private account to public retains the existing convention of
accepting its pending requests. Changing to private keeps existing accepted
followers. `showFollowerLists=false` restricts lists to the owner, including
when an approved follower otherwise has private-content access.

Non-followers can see basic identity/profile details and accepted connection
counts, but not private posts, post media or connection rows. Blocks take
precedence. Independently published commerce/service listings remain governed
by their own marketplace publication rules; profile privacy is not an archive
command for a public Shop product.

The backend rechecks privacy for feeds, profile grids and direct post reads.
Social events refresh the affected accounts; privacy-setting changes issue a
data-free global refresh. The mobile cache cancels stale requests and clears
restricted content before refetching, including on stream reconnect/foreground.
Account changes clear the previous account's query cache.

## Deployment and limits

Build contracts, apply `db:migrate`, deploy the API, then distribute the updated
mobile build. These changes are not automatically deployed to production.
An older server response produces a retryable list error rather than a crash.

Previously downloaded files cannot be withdrawn from a device. Existing signed
R2 URLs also remain valid until expiry (currently up to 15 minutes).
Cloudflare Stream playback tokens have a separate configured lifetime (one hour
by default, capped at 24 hours), and also cannot be revoked by a follow change.
Immediate revocation of an already issued media URL would require an authenticated
delivery proxy or equivalent revocable media authorization. API authorization
and list/content cache revocation are enforced independently of this limit.

The legacy Settings request list remains available. The Connections screen
also exposes owner-only pending requests, using a paginated requests endpoint
and a More Requests action.
