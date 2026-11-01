/*
# Add birth_date to persons and is_key_position to positions

1. Modified Tables
- `persons`: adds optional `birth_date` column (date type, nullable) for tracking
  soldier birth dates. Enables dynamic age calculation on the frontend.
- `positions`: adds `is_key_position` boolean column (default false) to flag
  critical roles like battalion commander, company commander, platoon leaders.

2. Security
- No changes to RLS policies. Both tables already have anon/authenticated CRUD
  policies from prior migrations. The new columns inherit existing access rules.

3. Important Notes
- Both columns are nullable/optional and default safely (false for is_key_position,
  NULL for birth_date) so existing rows are unaffected.
- The app is single-tenant (no auth screen), so anon access continues to work.
*/

-- Add birth_date to persons (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'persons' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE persons ADD COLUMN birth_date date;
  END IF;
END $$;

-- Add is_key_position to positions (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'is_key_position'
  ) THEN
    ALTER TABLE positions ADD COLUMN is_key_position boolean NOT NULL DEFAULT false;
  END IF;
END $$;
