/*
# Create System Users & RBAC Table

## Purpose
Create a dedicated table for system login/access profiles (system_users) that is
completely separate from the operational `persons` (soldiers/roster) table.
This table manages who can log into the admin system, their role, and their
assigned unit scope for data isolation.

## New Table: system_users
- `id` (uuid, PK, default gen_random_uuid())
- `email` (text, unique, not null) — login email
- `full_name` (text, not null) — display name
- `role` (text, not null) — one of: 'ADMIN', 'BATTALION_ADMIN', 'COMPANY_ADMIN', 'VIEWER'
- `assigned_unit_id` (uuid, nullable) — FK to units(id), the unit subtree this user can manage.
  NULL means full brigade access (ADMIN only).
- `is_active` (boolean, default true) — whether the user can log in
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Data Isolation
- This table is completely independent of the `persons` table.
- Creating/editing system users does NOT touch the operational roster.
- The `assigned_unit_id` references `units` only for scope filtering purposes.

## Security
- RLS enabled on system_users.
- CRUD policies for anon + authenticated (single-tenant demo app with role simulator).

## Seed Data
- One ADMIN user (full brigade access)
- One BATTALION_ADMIN user (scoped to גדוד 1891)
- One COMPANY_ADMIN user (scoped to a company under גדוד 1891)
*/

CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'BATTALION_ADMIN', 'COMPANY_ADMIN', 'VIEWER')),
  assigned_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_system_users" ON system_users;
CREATE POLICY "anon_select_system_users"
ON system_users FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_system_users" ON system_users;
CREATE POLICY "anon_insert_system_users"
ON system_users FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_system_users" ON system_users;
CREATE POLICY "anon_update_system_users"
ON system_users FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_system_users" ON system_users;
CREATE POLICY "anon_delete_system_users"
ON system_users FOR DELETE
TO anon, authenticated USING (true);

-- Seed demo users
-- Get unit IDs for seeding
DO $$
DECLARE
  brigade_id uuid;
  bn_1891_id uuid;
  company_under_1891 uuid;
BEGIN
  SELECT id INTO brigade_id FROM units WHERE name = 'חטיבה 189' LIMIT 1;
  SELECT id INTO bn_1891_id FROM units WHERE name = 'גדוד 1891' LIMIT 1;
  SELECT id INTO company_under_1891 FROM units WHERE unit_type = 'COMPANY' AND parent_unit_id = bn_1891_id LIMIT 1;

  INSERT INTO system_users (email, full_name, role, assigned_unit_id, is_active) VALUES
    ('admin@brigade189.idf', 'מנהל מערכת', 'ADMIN', brigade_id, true),
    ('battalion.admin@brigade189.idf', 'מנהל גדוד 1891', 'BATTALION_ADMIN', bn_1891_id, true),
    ('company.admin@brigade189.idf', 'מנהל פלוגה', 'COMPANY_ADMIN', company_under_1891, true)
  ON CONFLICT (email) DO NOTHING;
END $$;
