import "dotenv/config";
import { sql } from "./client.js";

async function migrate() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      name text NOT NULL,
      password_hash text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roles (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS permissions (
      id text PRIMARY KEY,
      description text
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id uuid,
      actor_email text,
      action text NOT NULL,
      entity_type text,
      entity_id text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS service_trees (
      id text PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      icon text,
      accent_color text,
      sort_order integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS service_categories (
      id text PRIMARY KEY,
      tree_id text NOT NULL REFERENCES service_trees(id) ON DELETE CASCADE,
      parent_id text,
      name text NOT NULL,
      description text,
      icon text,
      action_type text,
      sort_order integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS parent_id text`;

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_devices (
      id text PRIMARY KEY,
      display_name text NOT NULL DEFAULT 'Guest',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      phone text NOT NULL UNIQUE,
      display_name text NOT NULL,
      avatar_url text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL,
      storage_provider text NOT NULL,
      storage_key text NOT NULL,
      bucket text NOT NULL,
      mime_type text,
      byte_size integer,
      width integer,
      height integer,
      checksum_sha256 text,
      original_filename text,
      access_level text NOT NULL DEFAULT 'public',
      processing_status text NOT NULL DEFAULT 'initiated',
      moderation_status text NOT NULL DEFAULT 'not_required',
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz,
      deleted_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS media_assets_checksum_idx
      ON media_assets (checksum_sha256)
      WHERE checksum_sha256 IS NOT NULL AND deleted_at IS NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS media_usages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      usage_type text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (media_id, entity_type, entity_id, usage_type)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS media_usages_entity_idx
      ON media_usages (entity_type, entity_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS upload_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      expires_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'open',
      expected_mime text NOT NULL,
      max_bytes integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stub_providers (
      id text PRIMARY KEY,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stub_products (
      id text PRIMARY KEY,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS stub_banners (
      id text PRIMARY KEY,
      title text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS external_id text
  `;
  await sql`
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS duration_ms integer
  `;
  await sql`
    ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS thumbnail_url text
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS media_assets_external_id_idx
      ON media_assets (external_id)
      WHERE external_id IS NOT NULL AND deleted_at IS NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      caption text,
      creator_name text NOT NULL,
      category text,
      status text NOT NULL DEFAULT 'draft',
      content_mode text NOT NULL DEFAULT 'standard',
      moderation_status text NOT NULL DEFAULT 'clear',
      is_sample boolean NOT NULL DEFAULT true,
      like_count integer NOT NULL DEFAULT 0,
      comment_count integer NOT NULL DEFAULT 0,
      save_count integer NOT NULL DEFAULT 0,
      view_count integer NOT NULL DEFAULT 0,
      completion_count integer NOT NULL DEFAULT 0,
      report_count integer NOT NULL DEFAULT 0,
      display_order integer NOT NULL DEFAULT 0,
      media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      cta_entity_type text,
      cta_entity_id text,
      cta_label text,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      submitted_for_review_at timestamptz,
      reviewed_at timestamptz,
      reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  // The first Reel control-center slice adds a strict lifecycle, moderation
  // state, and server-owned engagement counters. Keep these upgrades
  // idempotent because early environments may already have the reels table.
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS content_mode text
  `;
  await sql`
    UPDATE reels
    SET content_mode = CASE WHEN is_sample THEN 'sample' ELSE 'standard' END
    WHERE content_mode IS NULL
  `;
  await sql`
    ALTER TABLE reels ALTER COLUMN content_mode SET DEFAULT 'standard'
  `;
  await sql`
    ALTER TABLE reels ALTER COLUMN content_mode SET NOT NULL
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'clear'
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS completion_count integer NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS reviewed_at timestamptz
  `;
  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_status_order_idx
      ON reels (status, display_order, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_public_feed_idx
      ON reels (status, moderation_status, content_mode, display_order, published_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_view_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL UNIQUE,
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      viewer_key text NOT NULL,
      viewer_kind text NOT NULL,
      session_id text,
      watched_ms integer NOT NULL DEFAULT 0,
      completed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_view_events_reel_created_idx
      ON reel_view_events (reel_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_view_events_reel_viewer_idx
      ON reel_view_events (reel_id, viewer_key)
  `;

  // A mobile player reports an early view and a natural completion for the
  // same session. Store those as one view so completion rate is sessions, not
  // raw events. Session-less clients retain event_id idempotency instead.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS reel_view_events_session_uid
      ON reel_view_events (reel_id, viewer_key, session_id)
      WHERE session_id IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_likes (
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      actor_key text NOT NULL,
      actor_kind text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (reel_id, actor_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      actor_key text NOT NULL,
      actor_kind text NOT NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'visible',
      created_at timestamptz NOT NULL DEFAULT now(),
      removed_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comments_reel_status_created_idx
      ON reel_comments (reel_id, status, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      reporter_key text NOT NULL,
      reporter_kind text NOT NULL,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      resolution_action text,
      resolution_note text,
      resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      UNIQUE (reel_id, reporter_key)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_reports_status_created_idx
      ON reel_reports (status, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_reports_reel_idx
      ON reel_reports (reel_id, created_at DESC)
  `;

  // Reels existed before media_usages supported the REEL/VIDEO relationship.
  // Backfill the link so existing assets are visible as in-use in the Media
  // Library and cannot be deleted out from under a Reel.
  await sql`
    INSERT INTO media_usages (media_id, entity_type, entity_id, usage_type, sort_order)
    SELECT media_id, 'REEL', id::text, 'VIDEO', 0
    FROM reels
    WHERE media_id IS NOT NULL
    ON CONFLICT DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_user_roles (
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      role_id text NOT NULL,
      PRIMARY KEY (mobile_user_id, role_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_form_schemas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scope text NOT NULL,
      category_id text REFERENCES service_categories(id) ON DELETE CASCADE,
      provider_kinds jsonb NOT NULL,
      version integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'published',
      sections jsonb NOT NULL,
      fields jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS provider_form_schemas_global_uid
      ON provider_form_schemas (scope)
      WHERE scope = 'global' AND status = 'published'
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS provider_form_schemas_category_uid
      ON provider_form_schemas (category_id)
      WHERE scope = 'category' AND status = 'published' AND category_id IS NOT NULL
  `;

  // The provider table is created here as well as in the legacy provider
  // migration below so membership/content tables can safely reference it in
  // both fresh and upgraded databases.
  await sql`
    CREATE TABLE IF NOT EXISTS providers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      provider_kind text NOT NULL,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      public_profile jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'content_creator', 'analyst')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider_id, mobile_user_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS provider_memberships_user_idx ON provider_memberships (mobile_user_id)`;
  await sql`
    INSERT INTO provider_memberships (provider_id, mobile_user_id, role)
    SELECT id, mobile_user_id, 'owner'
    FROM providers
    ON CONFLICT (provider_id, mobile_user_id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS content_containers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_mobile_user_id uuid REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
      format text NOT NULL CHECK (format IN ('flash', 'story', 'clip')),
      media_type text NOT NULL CHECK (media_type IN ('text', 'image', 'video', 'hybrid')),
      caption text NOT NULL DEFAULT '',
      media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
      tagged_mobile_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      location jsonb,
      visibility text NOT NULL DEFAULT 'public',
      status text NOT NULL DEFAULT 'ready_to_publish' CHECK (status IN ('draft', 'ready_to_publish', 'published', 'discarded')),
      created_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz,
      CHECK ((author_mobile_user_id IS NULL) <> (author_provider_id IS NULL))
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS content_containers_creator_idx ON content_containers (created_by_mobile_user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS content_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      container_id uuid REFERENCES content_containers(id) ON DELETE SET NULL,
      created_by_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_mobile_user_id uuid REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
      format text NOT NULL CHECK (format IN ('flash', 'story', 'clip')),
      media_type text NOT NULL CHECK (media_type IN ('text', 'image', 'video', 'hybrid')),
      caption text NOT NULL DEFAULT '',
      media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
      tagged_mobile_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      location jsonb,
      duplicate_cluster_id text NOT NULL,
      visibility text NOT NULL DEFAULT 'public',
      status text NOT NULL DEFAULT 'published',
      view_count integer NOT NULL DEFAULT 0,
      like_count integer NOT NULL DEFAULT 0,
      comment_count integer NOT NULL DEFAULT 0,
      share_count integer NOT NULL DEFAULT 0,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((author_mobile_user_id IS NULL) <> (author_provider_id IS NULL))
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS content_posts_feed_idx ON content_posts (format, published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS content_posts_expiry_idx ON content_posts (expires_at) WHERE expires_at IS NOT NULL`;

  // Content publishing gained metadata and durable feed-delivery claims after
  // the first mobile rollout. Keep upgrades safe for databases that created
  // the original minimal tables.
  await sql`
    ALTER TABLE content_containers
      ADD COLUMN IF NOT EXISTS thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS tagged_mobile_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS location jsonb
  `;
  await sql`
    ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS tagged_mobile_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS location jsonb,
      ADD COLUMN IF NOT EXISTS duplicate_cluster_id text,
      ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0
  `;
  await sql`
    UPDATE content_posts
    SET duplicate_cluster_id = COALESCE(NULLIF(media_ids ->> 0, ''), id::text)
    WHERE duplicate_cluster_id IS NULL
  `;
  await sql`
    ALTER TABLE content_posts
      ALTER COLUMN duplicate_cluster_id SET NOT NULL
  `;
  await sql`CREATE INDEX IF NOT EXISTS content_posts_cluster_idx ON content_posts (duplicate_cluster_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS content_post_deliveries (
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      content_post_id uuid NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
      claimed_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      PRIMARY KEY (mobile_user_id, content_post_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_deliveries_expiry_idx
      ON content_post_deliveries (mobile_user_id, expires_at)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS content_cluster_deliveries (
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      duplicate_cluster_id text NOT NULL,
      claimed_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      PRIMARY KEY (mobile_user_id, duplicate_cluster_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_cluster_deliveries_expiry_idx
      ON content_cluster_deliveries (mobile_user_id, expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS content_post_view_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      content_post_id uuid NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      event_id uuid NOT NULL,
      watched_ms integer NOT NULL CHECK (watched_ms >= 1000),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (content_post_id, mobile_user_id, event_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_view_events_post_created_idx
      ON content_post_view_events (content_post_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_view_events_viewer_idx
      ON content_post_view_events (content_post_id, mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS content_post_likes (
      content_post_id uuid NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (content_post_id, mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_likes_user_created_idx
      ON content_post_likes (mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS content_post_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      content_post_id uuid NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
      reporter_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (content_post_id, reporter_mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_reports_status_created_idx
      ON content_post_reports (status, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS providers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      provider_kind text NOT NULL,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      public_profile jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS providers_mobile_user_uid
      ON providers (mobile_user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_service_offerings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      category_id text NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      pricing_starts_at integer,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider_id, category_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      provider_kind text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      common_payload jsonb,
      dynamic_payload jsonb,
      review_notes text,
      info_request_message text,
      provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
      submitted_at timestamptz,
      reviewed_at timestamptz,
      reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS provider_applications_status_idx
      ON provider_applications (status, submitted_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_application_services (
      application_id uuid NOT NULL REFERENCES provider_applications(id) ON DELETE CASCADE,
      category_id text NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      PRIMARY KEY (application_id, category_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_application_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id uuid NOT NULL REFERENCES provider_applications(id) ON DELETE CASCADE,
      field_key text NOT NULL,
      media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
      aadhaar_encrypted text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (application_id, field_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      title text,
      persona_version text NOT NULL DEFAULT '1',
      status text NOT NULL DEFAULT 'active',
      last_response_id text,
      current_screen text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_conversations_user_updated_idx
      ON assistant_conversations (mobile_user_id, updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text,
      tool_calls jsonb,
      tool_results jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_messages_conversation_created_idx
      ON assistant_messages (conversation_id, created_at ASC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS assistant_analytics_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      conversation_id uuid REFERENCES assistant_conversations(id) ON DELETE SET NULL,
      type text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS assistant_analytics_user_created_idx
      ON assistant_analytics_events (mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_behavior_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      type text NOT NULL,
      entity_type text,
      entity_id text,
      metadata jsonb,
      idempotency_key text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_behavior_events_idempotency_uidx
      ON user_behavior_events (mobile_user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_behavior_events_user_created_idx
      ON user_behavior_events (mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_preference_settings (
      mobile_user_id uuid PRIMARY KEY REFERENCES mobile_users(id) ON DELETE CASCADE,
      personalization_enabled boolean NOT NULL DEFAULT true,
      explicit_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_preference_scores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      score double precision NOT NULL DEFAULT 0,
      confidence double precision NOT NULL DEFAULT 0,
      evidence_count integer NOT NULL DEFAULT 0,
      last_interaction_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (mobile_user_id, entity_type, entity_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_preference_scores_user_score_idx
      ON user_preference_scores (mobile_user_id, score DESC)
  `;

  await sql`
    ALTER TABLE mobile_users
      ADD COLUMN IF NOT EXISTS interests_completed_at timestamptz
  `;

  await sql`
    ALTER TABLE mobile_users
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS location text,
      ADD COLUMN IF NOT EXISTS website text
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interest_options (
      id text PRIMARY KEY,
      name text NOT NULL,
      image_url text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS interest_options_active_order_idx
      ON interest_options (is_active, sort_order)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS mobile_user_interests (
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      interest_id text NOT NULL REFERENCES interest_options(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (mobile_user_id, interest_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS mobile_user_interests_interest_idx
      ON mobile_user_interests (interest_id)
  `;

  // A block has one precise target. We retain separate target columns rather
  // than treating a provider as a user, so a business-only block does not
  // silently hide the personal profile of the people who operate it.
  await sql`
    CREATE TABLE IF NOT EXISTS mobile_user_blocks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      blocked_mobile_user_id uuid REFERENCES mobile_users(id) ON DELETE CASCADE,
      blocked_provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((blocked_mobile_user_id IS NULL) <> (blocked_provider_id IS NULL)),
      CHECK (blocker_mobile_user_id IS DISTINCT FROM blocked_mobile_user_id)
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS mobile_user_blocks_user_target_uidx
      ON mobile_user_blocks (blocker_mobile_user_id, blocked_mobile_user_id)
      WHERE blocked_mobile_user_id IS NOT NULL
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS mobile_user_blocks_provider_target_uidx
      ON mobile_user_blocks (blocker_mobile_user_id, blocked_provider_id)
      WHERE blocked_provider_id IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS mobile_user_blocks_blocker_created_idx
      ON mobile_user_blocks (blocker_mobile_user_id, created_at DESC)
  `;

  await sql`
    INSERT INTO interest_options (id, name, image_url, sort_order)
    VALUES
      ('art', 'Art', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80', 10),
      ('fashion', 'Fashion', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80', 20),
      ('design', 'Design', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=600&q=80', 30),
      ('sports', 'Sports', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80', 40),
      ('music', 'Music', 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=600&q=80', 50),
      ('gaming', 'Gaming', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80', 60),
      ('news', 'News', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=600&q=80', 70),
      ('travel', 'Travel', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80', 80),
      ('fitness', 'Fitness', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80', 90),
      ('cooking', 'Cooking', 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80', 100),
      ('business', 'Business', 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=600&q=80', 110),
      ('technology', 'Technology', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', 120)
    ON CONFLICT (id) DO NOTHING
  `;

  // Full-text search for assistant discovery
  await sql`
    ALTER TABLE mobile_users ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(display_name, ''))) STORED
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS mobile_users_search_idx
      ON mobile_users USING gin (search_vector)
  `;

  await sql`
    ALTER TABLE reels ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(caption, '') || ' ' || coalesce(category, ''))
      ) STORED
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS reels_search_idx
      ON reels USING gin (search_vector)
  `;

  await sql`
    ALTER TABLE service_trees ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS service_trees_search_idx
      ON service_trees USING gin (search_vector)
  `;

  await sql`
    ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS search_vector tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS service_categories_search_idx
      ON service_categories USING gin (search_vector)
  `;

  /** Bookings table migration - append-only block to minimize merge conflicts */
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
      category_id text REFERENCES service_categories(id) ON DELETE SET NULL,
      category text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      service_mode text NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz,
      duration_minutes integer,
      amount integer,
      payment_status text NOT NULL DEFAULT 'pending',
      detail jsonb NOT NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz,
      completed_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS bookings_user_starts_idx
      ON bookings (mobile_user_id, starts_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS bookings_provider_starts_idx
      ON bookings (provider_id, starts_at DESC)
      WHERE provider_id IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS bookings_status_starts_idx
      ON bookings (status, starts_at DESC)
  `;

  /** Shop tables migration - append-only block to minimize merge conflicts */
  await sql`
    CREATE TABLE IF NOT EXISTS product_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      description text,
      image_url text,
      sort_order integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS product_categories_status_sort_idx
      ON product_categories (status, sort_order)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
      slug text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      price integer NOT NULL,
      compare_at_price integer,
      inventory integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'draft',
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS products_category_status_idx
      ON products (category_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS products_slug_idx
      ON products (slug)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_images (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
      alt text,
      sort_order integer NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS product_images_product_idx
      ON product_images (product_id, sort_order)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number text NOT NULL UNIQUE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      items jsonb NOT NULL,
      subtotal integer NOT NULL,
      shipping integer NOT NULL,
      tax integer NOT NULL,
      total integer NOT NULL,
      shipping_address jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      payment_status text NOT NULL DEFAULT 'pending',
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz,
      completed_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_user_created_idx
      ON orders (mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_status_created_idx
      ON orders (status, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_number_idx
      ON orders (order_number)
  `;

  
  /** Notifications */
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      type text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      data jsonb,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx
      ON notifications (mobile_user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
      ON notifications (mobile_user_id, read_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      token text NOT NULL,
      platform text NOT NULL CHECK (platform IN ('android', 'ios')),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (token)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS device_tokens_user_idx
      ON device_tokens (mobile_user_id)
  `;

  /** Communities */
  await sql`
    CREATE TABLE IF NOT EXISTS communities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      description text,
      image_url text,
      cover_url text,
      member_count integer NOT NULL DEFAULT 1,
      post_count integer NOT NULL DEFAULT 0,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      suspended_at timestamptz
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS communities_status_created_idx
      ON communities (status, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      joined_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (community_id, mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_members_user_idx
      ON community_members (mobile_user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_members_community_joined_idx
      ON community_members (community_id, joined_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      content text NOT NULL,
      media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      like_count integer NOT NULL DEFAULT 0,
      comment_count integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'visible',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      removed_at timestamptz
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_posts_community_created_idx
      ON community_posts (community_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_posts_author_idx
      ON community_posts (author_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_post_likes (
      post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_post_likes_user_created_idx
      ON community_post_likes (mobile_user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_post_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      content text NOT NULL,
      status text NOT NULL DEFAULT 'visible',
      created_at timestamptz NOT NULL DEFAULT now(),
      removed_at timestamptz
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_post_comments_post_created_idx
      ON community_post_comments (post_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS community_post_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      reporter_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      UNIQUE (post_id, reporter_mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS community_post_reports_status_created_idx
      ON community_post_reports (status, created_at DESC)
  `;

  /** Courses */
  await sql`
    CREATE TABLE IF NOT EXISTS courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug text NOT NULL,
      name text NOT NULL,
      short_description text NOT NULL,
      description text NOT NULL,
      difficulty text NOT NULL,
      duration_hours integer NOT NULL,
      price integer NOT NULL,
      compare_at_price integer,
      image_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      instructor_name text NOT NULL,
      instructor_bio text,
      learning_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
      prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'draft',
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS courses_slug_uidx
      ON courses (slug)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS courses_status_created_idx
      ON courses (status, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS courses_difficulty_status_idx
      ON courses (difficulty, status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS course_lessons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      module_number integer NOT NULL,
      module_name text NOT NULL,
      lesson_number integer NOT NULL,
      title text NOT NULL,
      description text,
      type text NOT NULL,
      duration_minutes integer,
      content_url text,
      content_text text,
      media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_free boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS course_lessons_course_sort_idx
      ON course_lessons (course_id, sort_order)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS course_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active',
      payment_status text NOT NULL DEFAULT 'pending',
      payment_amount integer NOT NULL,
      progress jsonb NOT NULL DEFAULT '[]'::jsonb,
      completed_lessons_count integer NOT NULL DEFAULT 0,
      total_lessons_count integer NOT NULL DEFAULT 0,
      last_accessed_at timestamptz,
      enrolled_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      metadata jsonb,
      UNIQUE (course_id, mobile_user_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS course_enrollments_user_idx
      ON course_enrollments (mobile_user_id)
  `;


/** Trips and Trip Bookings migration - append-only block to minimize merge conflicts */
  await sql`
    CREATE TABLE IF NOT EXISTS trips (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text NOT NULL,
      description text NOT NULL,
      destination text NOT NULL,
      duration_days integer NOT NULL,
      base_price integer NOT NULL,
      max_group_size integer NOT NULL,
      itinerary jsonb NOT NULL,
      inclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
      exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
      difficulty text NOT NULL,
      image_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      status text NOT NULL DEFAULT 'draft',
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS trips_slug_uidx
      ON trips (slug)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trips_destination_status_idx
      ON trips (destination, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trips_status_created_idx
      ON trips (status, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trip_bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_number text NOT NULL UNIQUE,
      trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      start_date timestamptz NOT NULL,
      number_of_travelers integer NOT NULL,
      total_price integer NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      payment_status text NOT NULL DEFAULT 'pending',
      traveler_details jsonb NOT NULL,
      special_requests text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz,
      completed_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS trip_bookings_trip_start_idx
      ON trip_bookings (trip_id, start_date)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trip_bookings_user_created_idx
      ON trip_bookings (mobile_user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trip_bookings_status_created_idx
      ON trip_bookings (status, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS trip_bookings_number_idx
      ON trip_bookings (booking_number)
  `;

  
  
  await sql`
    ALTER TABLE course_enrollments
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `;

  // Clip editor (on-device trim + music). Additive only: nullable columns and
  // a new table, so this is safe to run against a live database and against
  // older app versions that never send `edit`.
  await sql`
    ALTER TABLE content_containers
      ADD COLUMN IF NOT EXISTS edit jsonb
  `;
  await sql`
    ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS edit jsonb,
      ADD COLUMN IF NOT EXISTS music_track_id text
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS music_tracks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      artist text,
      duration_ms integer NOT NULL CHECK (duration_ms > 0),
      media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      audio_url text,
      license text NOT NULL,
      attribution text,
      is_active boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS music_tracks_active_idx
      ON music_tracks (is_active, sort_order)
  `;

  // ── Content publisher profiles + lifecycle (fix/content-publisher-profiles)
  //
  // Every statement is idempotent and safe on a live database:
  //  * publisher_profile_id/type are STORED generated columns derived from
  //    the existing author_mobile_user_id/author_provider_id pair (which a
  //    CHECK already requires to be exactly one). Adding them backfills every
  //    existing row automatically (personal profile = the owning mobile user)
  //    and they can never drift from the author columns afterwards.
  //  * content_containers.status gains the full lifecycle vocabulary. The
  //    constraint is replaced inside one ALTER so there is no window without it.
  //  * Existing published rows are untouched. Only legacy containers stuck in
  //    `ready_to_publish` whose media is all ready (an upload that never got a
  //    post because the publish step failed) are published, once.
  await sql`
    ALTER TABLE content_containers
      ADD COLUMN IF NOT EXISTS failure_reason text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS publisher_profile_id uuid GENERATED ALWAYS AS (COALESCE(author_provider_id, author_mobile_user_id)) STORED,
      ADD COLUMN IF NOT EXISTS publisher_profile_type text GENERATED ALWAYS AS (CASE WHEN author_provider_id IS NOT NULL THEN 'business' ELSE 'personal' END) STORED
  `;
  await sql`
    ALTER TABLE content_containers
      DROP CONSTRAINT IF EXISTS content_containers_status_check,
      ADD CONSTRAINT content_containers_status_check CHECK (status IN (
        'draft', 'uploading', 'processing', 'ready_to_publish',
        'pending_review', 'published', 'rejected', 'failed', 'discarded'
      ))
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_containers_owner_status_idx
      ON content_containers (created_by_mobile_user_id, status, created_at DESC)
  `;
  await sql`
    ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS review_note text,
      ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
      ADD COLUMN IF NOT EXISTS publisher_profile_id uuid GENERATED ALWAYS AS (COALESCE(author_provider_id, author_mobile_user_id)) STORED,
      ADD COLUMN IF NOT EXISTS publisher_profile_type text GENERATED ALWAYS AS (CASE WHEN author_provider_id IS NOT NULL THEN 'business' ELSE 'personal' END) STORED
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_posts_publisher_status_published_idx
      ON content_posts (publisher_profile_id, status, published_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_posts_status_visibility_published_idx
      ON content_posts (status, visibility, published_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_posts_story_expiry_status_idx
      ON content_posts (expires_at, status)
      WHERE format = 'story'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS content_post_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      content_post_id uuid NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
      owner_mobile_user_id uuid NOT NULL REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_mobile_user_id uuid REFERENCES mobile_users(id) ON DELETE CASCADE,
      author_provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
      publisher_profile_id uuid GENERATED ALWAYS AS (COALESCE(author_provider_id, author_mobile_user_id)) STORED,
      publisher_profile_type text GENERATED ALWAYS AS (CASE WHEN author_provider_id IS NOT NULL THEN 'business' ELSE 'personal' END) STORED,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'published',
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((author_mobile_user_id IS NULL) <> (author_provider_id IS NULL))
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS content_post_comments_post_created_idx
      ON content_post_comments (content_post_id, created_at)
  `;

  // content_post_reports was created without the resolution columns that the
  // Drizzle schema (and the moderation routes) use, so every content report
  // insert failed. Additive and nullable, therefore safe on live data.
  await sql`
    ALTER TABLE content_post_reports
      ADD COLUMN IF NOT EXISTS resolution_action text,
      ADD COLUMN IF NOT EXISTS resolution_note text,
      ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS resolved_at timestamptz
  `;

  // One-time (idempotent) recovery of uploads that never became posts. A
  // container is only published when every attached media asset is ready,
  // live and approved; text-only containers need a caption. Stories are
  // given their original 24h window, so stale ones are created already
  // expired and never surface in the tray.
  await sql`
    WITH eligible AS (
      SELECT c.*
      FROM content_containers c
      WHERE c.status = 'ready_to_publish'
        AND NOT EXISTS (SELECT 1 FROM content_posts p WHERE p.container_id = c.id)
        AND (
          (c.media_type = 'text' AND length(c.caption) > 0)
          OR (c.media_type <> 'text' AND jsonb_array_length(c.media_ids) > 0)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(c.media_ids) AS m(media_id)
          LEFT JOIN media_assets a ON a.id::text = m.media_id
          WHERE a.id IS NULL
             OR a.processing_status <> 'ready'
             OR a.deleted_at IS NOT NULL
             OR a.archived_at IS NOT NULL
             OR a.moderation_status NOT IN ('approved', 'not_required')
        )
    ),
    inserted AS (
      INSERT INTO content_posts (
        container_id, created_by_mobile_user_id, author_mobile_user_id,
        author_provider_id, format, media_type, caption, media_ids,
        thumbnail_media_id, hashtags, tagged_mobile_user_ids, location,
        duplicate_cluster_id, visibility, edit, music_track_id, status,
        expires_at, created_at, published_at
      )
      SELECT
        e.id, e.created_by_mobile_user_id, e.author_mobile_user_id,
        e.author_provider_id, e.format, e.media_type, e.caption, e.media_ids,
        e.thumbnail_media_id, e.hashtags, e.tagged_mobile_user_ids, e.location,
        COALESCE(
          (
            SELECT COALESCE(a.checksum_sha256, a.id::text)
            FROM jsonb_array_elements_text(e.media_ids) AS m(media_id)
            JOIN media_assets a ON a.id::text = m.media_id
            WHERE a.kind = 'video'
            LIMIT 1
          ),
          e.id::text
        ),
        e.visibility, e.edit, e.edit -> 'music' ->> 'trackId', 'published',
        CASE WHEN e.format = 'story' THEN e.created_at + interval '24 hours' END,
        e.created_at, e.created_at
      FROM eligible e
      RETURNING container_id
    )
    UPDATE content_containers c
    SET status = 'published', published_at = c.created_at, updated_at = now()
    FROM inserted i
    WHERE c.id = i.container_id
  `;

  console.log("Migrations applied.");
  await sql.end({ timeout: 5 });
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
