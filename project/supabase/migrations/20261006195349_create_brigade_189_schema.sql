/*
# Brigade 189 Manpower Management — Initial Schema

## Overview
Creates the core database tables for the Brigade 189 manpower management system.
This is a single-tenant application with no authentication — all data is shared
and accessible to anonymous users via the anon key.

## New Tables

### 1. `units`
- `id` (uuid, primary key, auto-generated)
- `name` (text, not null) — display name of the unit (e.g., "חטיבה 189", "גדוד 503")
- `unit_type` (enum: BRIGADE, BATTALION, FRAMEWORK, COMPANY, PLATOON, SQUAD) — hierarchical level
- `parent_unit_id` (uuid, nullable, FK → units.id ON DELETE SET NULL) — parent unit for tree structure
- `created_at` (timestamptz, default now())

### 2. `positions`
- `id` (uuid, primary key, auto-generated)
- `unit_id` (uuid, nullable, FK → units.id ON DELETE SET NULL) — the unit this position belongs to
- `title` (text, not null) — position title (e.g., "מ"מ 1", "סמג"ד")
- `code` (text, nullable) — position code/identifier
- `rank_required` (text, nullable) — required military rank
- `is_active` (boolean, default true) — whether the position is currently active
- `created_at` (timestamptz, default now())

### 3. `persons`
- `id` (uuid, primary key, auto-generated)
- `personal_id` (text, unique, not null) — military personal ID number (מספר אישי)
- `first_name` (text, not null) — first name (שם פרטי)
- `last_name` (text, not null) — last name (שם משפחה)
- `rank` (text, nullable) — military rank (טוראי עד אלוף)
- `service_status` (text, nullable) — service status: סדיר / קבע / מילואים
- `phone_number` (text, nullable) — phone number
- `unit_id` (uuid, nullable, FK → units.id ON DELETE SET NULL) — unit assignment for org tree display
- `position_id` (uuid, nullable, FK → positions.id ON DELETE SET NULL) — position assignment
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on all three tables.
- Since this is a no-auth single-tenant app, all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` — the data is intentionally shared.
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE).

## Important Notes
1. `persons.unit_id` and `persons.position_id` are nullable to allow unassigned personnel.
2. `parent_unit_id` on `units` is self-referencing and nullable (root units like the Brigade have no parent).
3. Indexes added on `units.parent_unit_id`, `positions.unit_id`, `persons.unit_id`, `persons.position_id`, and `persons.personal_id` for query performance.
*/

-- ===================== units table =====================
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('BRIGADE', 'BATTALION', 'FRAMEWORK', 'COMPANY', 'PLATOON', 'SQUAD')),
  parent_unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_units" ON units;
CREATE POLICY "anon_select_units" ON units FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_units" ON units;
CREATE POLICY "anon_insert_units" ON units FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_units" ON units;
CREATE POLICY "anon_update_units" ON units FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_units" ON units;
CREATE POLICY "anon_delete_units" ON units FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== positions table =====================
CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  title text NOT NULL,
  code text,
  rank_required text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_positions" ON positions;
CREATE POLICY "anon_select_positions" ON positions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_positions" ON positions;
CREATE POLICY "anon_insert_positions" ON positions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_positions" ON positions;
CREATE POLICY "anon_update_positions" ON positions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_positions" ON positions;
CREATE POLICY "anon_delete_positions" ON positions FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== persons table =====================
CREATE TABLE IF NOT EXISTS persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  rank text,
  service_status text CHECK (service_status IN ('סדיר', 'קבע', 'מילואים')),
  phone_number text,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_persons" ON persons;
CREATE POLICY "anon_select_persons" ON persons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_persons" ON persons;
CREATE POLICY "anon_insert_persons" ON persons FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_persons" ON persons;
CREATE POLICY "anon_update_persons" ON persons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_persons" ON persons;
CREATE POLICY "anon_delete_persons" ON persons FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== Indexes =====================
CREATE INDEX IF NOT EXISTS idx_units_parent ON units(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_positions_unit ON positions(unit_id);
CREATE INDEX IF NOT EXISTS idx_persons_unit ON persons(unit_id);
CREATE INDEX IF NOT EXISTS idx_persons_position ON persons(position_id);
CREATE INDEX IF NOT EXISTS idx_persons_personal_id ON persons(personal_id);

-- ===================== Seed: Brigade 189 root unit =====================
INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'חטיבה 189', 'BRIGADE', NULL
WHERE NOT EXISTS (SELECT 1 FROM units WHERE unit_type = 'BRIGADE');
