/*
# Phase 2: Assignments, Qualifications, Position Requirements, Audit Logs

## Overview
Adds 5 new tables to support position assignments, qualifications management,
position readiness status calculation, and audit logging.

## New Tables

### 1. `qualifications`
- `id` (uuid, PK)
- `name` (text, unique, not null) — qualification name (e.g., "קורס מ"מים")
- `description` (text, nullable)
- `created_at` (timestamptz)

### 2. `position_requirements`
- `id` (uuid, PK)
- `position_id` (uuid, FK → positions, ON DELETE CASCADE)
- `qualification_id` (uuid, FK → qualifications, ON DELETE CASCADE)
- UNIQUE(position_id, qualification_id) — prevents duplicate requirements

### 3. `person_qualifications`
- `id` (uuid, PK)
- `person_id` (uuid, FK → persons, ON DELETE CASCADE)
- `qualification_id` (uuid, FK → qualifications, ON DELETE CASCADE)
- `acquired_date` (date, nullable)
- `created_at` (timestamptz)
- UNIQUE(person_id, qualification_id) — prevents duplicate qualifications

### 4. `assignments`
- `id` (uuid, PK)
- `position_id` (uuid, FK → positions, ON DELETE CASCADE)
- `person_id` (uuid, FK → persons, ON DELETE CASCADE)
- `assignment_type` (text, CHECK: PERMANENT | ACTING | TEMPORARY)
- `is_active` (boolean, default true)
- `start_date` (date, nullable)
- `end_date` (date, nullable)
- `notes` (text, nullable)
- `created_at` (timestamptz)

### 5. `audit_logs`
- `id` (uuid, PK)
- `action` (text, not null) — action description
- `entity_type` (text, not null) — table name affected
- `entity_id` (uuid, nullable) — row ID affected
- `details` (jsonb, nullable) — additional context
- `created_at` (timestamptz)

## Security
- RLS enabled on all 5 new tables.
- All policies use `TO anon, authenticated` with `USING(true)` / `WITH CHECK(true)` — single-tenant no-auth app.

## Important Notes
1. All FK constraints use ON DELETE CASCADE where appropriate so deleting a person/position/qualification cleans up related rows.
2. UNIQUE constraints on position_requirements and person_qualifications prevent duplicate entries.
3. Indexes added on all FK columns and frequently queried columns.
*/

-- ===================== qualifications =====================
CREATE TABLE IF NOT EXISTS qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_qualifications" ON qualifications;
CREATE POLICY "anon_select_qualifications" ON qualifications FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_qualifications" ON qualifications;
CREATE POLICY "anon_insert_qualifications" ON qualifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_qualifications" ON qualifications;
CREATE POLICY "anon_update_qualifications" ON qualifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_qualifications" ON qualifications;
CREATE POLICY "anon_delete_qualifications" ON qualifications FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== position_requirements =====================
CREATE TABLE IF NOT EXISTS position_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(position_id, qualification_id)
);

ALTER TABLE position_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_position_requirements" ON position_requirements;
CREATE POLICY "anon_select_position_requirements" ON position_requirements FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_position_requirements" ON position_requirements;
CREATE POLICY "anon_insert_position_requirements" ON position_requirements FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_position_requirements" ON position_requirements;
CREATE POLICY "anon_update_position_requirements" ON position_requirements FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_position_requirements" ON position_requirements;
CREATE POLICY "anon_delete_position_requirements" ON position_requirements FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== person_qualifications =====================
CREATE TABLE IF NOT EXISTS person_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  qualification_id uuid NOT NULL REFERENCES qualifications(id) ON DELETE CASCADE,
  acquired_date date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(person_id, qualification_id)
);

ALTER TABLE person_qualifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_person_qualifications" ON person_qualifications;
CREATE POLICY "anon_select_person_qualifications" ON person_qualifications FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_person_qualifications" ON person_qualifications;
CREATE POLICY "anon_insert_person_qualifications" ON person_qualifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_person_qualifications" ON person_qualifications;
CREATE POLICY "anon_update_person_qualifications" ON person_qualifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_person_qualifications" ON person_qualifications;
CREATE POLICY "anon_delete_person_qualifications" ON person_qualifications FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== assignments =====================
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('PERMANENT', 'ACTING', 'TEMPORARY')),
  is_active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_assignments" ON assignments;
CREATE POLICY "anon_select_assignments" ON assignments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_assignments" ON assignments;
CREATE POLICY "anon_insert_assignments" ON assignments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_assignments" ON assignments;
CREATE POLICY "anon_update_assignments" ON assignments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_assignments" ON assignments;
CREATE POLICY "anon_delete_assignments" ON assignments FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== audit_logs =====================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_logs" ON audit_logs;
CREATE POLICY "anon_select_audit_logs" ON audit_logs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
CREATE POLICY "anon_insert_audit_logs" ON audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_logs" ON audit_logs;
CREATE POLICY "anon_update_audit_logs" ON audit_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_logs" ON audit_logs;
CREATE POLICY "anon_delete_audit_logs" ON audit_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ===================== Indexes =====================
CREATE INDEX IF NOT EXISTS idx_position_requirements_position ON position_requirements(position_id);
CREATE INDEX IF NOT EXISTS idx_position_requirements_qual ON position_requirements(qualification_id);
CREATE INDEX IF NOT EXISTS idx_person_qualifications_person ON person_qualifications(person_id);
CREATE INDEX IF NOT EXISTS idx_person_qualifications_qual ON person_qualifications(qualification_id);
CREATE INDEX IF NOT EXISTS idx_assignments_position ON assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ===================== Seed sample qualifications =====================
INSERT INTO qualifications (name, description)
SELECT 'קורס מ"מים', 'הסמכה לפיקוד על מחלקה'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'קורס מ"מים');

INSERT INTO qualifications (name, description)
SELECT 'קורס מפקדי כיתות', 'הסמכה לפיקוד על כיתה'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'קורס מפקדי כיתות');

INSERT INTO qualifications (name, description)
SELECT 'קורס קצינים', 'הסמכת קצונה'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'קורס קצינים');

INSERT INTO qualifications (name, description)
SELECT 'קורס חובשים', 'הסמכת חובש קדמי'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'קורס חובשים');

INSERT INTO qualifications (name, description)
SELECT 'קורס צלפים', 'הסמכת צלף'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'קורס צלפים');

INSERT INTO qualifications (name, description)
SELECT 'מקצוע חי"ר', 'הסמכה במקצועות חיל רגלים'
WHERE NOT EXISTS (SELECT 1 FROM qualifications WHERE name = 'מקצוע חי"ר');
