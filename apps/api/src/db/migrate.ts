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

  console.log("Migrations applied.");
  await sql.end({ timeout: 5 });
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
