/*
# Add expiration_date to person_qualifications and category to qualifications

1. Modified Tables
- `person_qualifications`: Add `expiration_date` (date, nullable) — optional expiration date for time-limited certifications (e.g., medical fitness, driving licenses).
- `qualifications`: Add `category` (text, nullable) — optional category for grouping qualifications (e.g., 'פיקוד', 'רפואי', 'נהיגה', 'נשק').

2. Security
- No RLS policy changes — existing policies already allow full CRUD for anon+authenticated.
- New columns are nullable so existing rows are unaffected.

3. Notes
- `expiration_date` allows the system to track certification validity and warn about expired or soon-to-expire qualifications.
- `category` enables filtering and grouping in the qualifications management UI.
*/

ALTER TABLE person_qualifications ADD COLUMN IF NOT EXISTS expiration_date date;

ALTER TABLE qualifications ADD COLUMN IF NOT EXISTS category text;

-- Update existing qualifications with categories based on name keywords
UPDATE qualifications SET category = 'פיקוד' WHERE name LIKE '%מ"מ%' OR name LIKE '%מפקד%' OR name LIKE '%קצין%' OR name LIKE '%קורס קצינים%';
UPDATE qualifications SET category = 'רפואי' WHERE name LIKE '%חובש%' OR name LIKE '%רופא%' OR name LIKE '%רפוא%' OR name LIKE '%פרמדיק%';
UPDATE qualifications SET category = 'נהיגה' WHERE name LIKE '%נהג%' OR name LIKE '%רישיון%' OR name LIKE '%היתר%';
UPDATE qualifications SET category = 'נשק' WHERE name LIKE '%צלף%' OR name LIKE '%נשק%' OR name LIKE '%ירי%';
UPDATE qualifications SET category = 'חי"ר' WHERE name LIKE '%חי"ר%' OR name LIKE '%חיל רגלים%';
