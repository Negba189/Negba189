/*
# Extend unit types and seed battalions 1891-1895

## Overview
Expands the `unit_type` enum constraint on the `units` table to include additional
military framework types (HEADQUARTERS, FORWARD_HQ, OPS_STAFF, LOGISTICS), and
seeds the five battalions (1891-1895) under the existing "חטיבה 189" root unit.

## Changes

### 1. Modified: `units.unit_type` CHECK constraint
- Dropped the existing `units_unit_type_check` constraint.
- Added a new CHECK constraint allowing these values:
  - BRIGADE (חטיבה)
  - BATTALION (גדוד)
  - HEADQUARTERS (מפקדה)
  - FORWARD_HQ (חפ"ק)
  - OPS_STAFF (אג"ם)
  - LOGISTICS (פלס"ם)
  - FRAMEWORK (מסגרת)
  - COMPANY (פלוגה)
  - PLATOON (מחלקה)
  - SQUAD (כיתה)
- Existing rows are not affected — the old values (BRIGADE, BATTALION, FRAMEWORK,
  COMPANY, PLATOON, SQUAD) are all still valid under the new constraint.

### 2. Seed data: Battalions 1891-1895
- Inserts 5 new battalion rows (גדוד 1891 through גדוד 1895) under the
  "חטיבה 189" brigade. Only inserts battalions that don't already exist
  (idempotent — safe to re-run).

## Important Notes
1. The new unit types are placed between BATTALION and FRAMEWORK in the hierarchy
   order, matching the Israeli military organizational structure.
2. No data is lost — only the constraint is replaced and new rows are inserted.
*/

-- Drop old constraint and add expanded one
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_unit_type_check;

ALTER TABLE units ADD CONSTRAINT units_unit_type_check
  CHECK (unit_type IN (
    'BRIGADE', 'BATTALION', 'HEADQUARTERS', 'FORWARD_HQ',
    'OPS_STAFF', 'LOGISTICS', 'FRAMEWORK', 'COMPANY', 'PLATOON', 'SQUAD'
  ));

-- Seed battalions 1891-1895 under Brigade 189
INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'גדוד 1891', 'BATTALION', u.id
FROM units u
WHERE u.unit_type = 'BRIGADE' AND u.name = 'חטיבה 189'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'גדוד 1891');

INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'גדוד 1892', 'BATTALION', u.id
FROM units u
WHERE u.unit_type = 'BRIGADE' AND u.name = 'חטיבה 189'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'גדוד 1892');

INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'גדוד 1893', 'BATTALION', u.id
FROM units u
WHERE u.unit_type = 'BRIGADE' AND u.name = 'חטיבה 189'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'גדוד 1893');

INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'גדוד 1894', 'BATTALION', u.id
FROM units u
WHERE u.unit_type = 'BRIGADE' AND u.name = 'חטיבה 189'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'גדוד 1894');

INSERT INTO units (name, unit_type, parent_unit_id)
SELECT 'גדוד 1895', 'BATTALION', u.id
FROM units u
WHERE u.unit_type = 'BRIGADE' AND u.name = 'חטיבה 189'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'גדוד 1895');
