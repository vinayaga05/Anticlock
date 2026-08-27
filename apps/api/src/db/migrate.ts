import 'dotenv/config';
import { sql } from './client.js';

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

  await sql`
    CREATE TABLE IF NOT EXISTS mobile_devices (
      id text PRIMARY KEY,
      display_name text NOT NULL DEFAULT 'Guest',
      created_at timestamptz NOT NULL DEFAULT now()
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
      is_sample boolean NOT NULL DEFAULT true,
      like_count integer NOT NULL DEFAULT 0,
      comment_count integer NOT NULL DEFAULT 0,
      save_count integer NOT NULL DEFAULT 0,
      display_order integer NOT NULL DEFAULT 0,
      media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      thumbnail_media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
      cta_entity_type text,
      cta_entity_id text,
      cta_label text,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_status_order_idx
      ON reels (status, display_order, created_at DESC)
  `;

  console.log('Migrations applied.');
  await sql.end({ timeout: 5 });
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
