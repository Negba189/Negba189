/*
# Add Password Authentication for System Users

## Purpose
Add a password_hash column to the system_users table and a SECURITY DEFINER
function to verify credentials at login. This enables email/password login
without using Supabase Auth (keeping system_users fully independent).

## Changes
1. Add `password_hash` column (text, nullable) to system_users
2. Create `verify_system_user_login(email, password)` SECURITY DEFINER function
   that returns the user record if credentials match, or null.
3. Seed password hashes for the 3 existing demo users.
   Passwords (demo): admin123, battalion123, company123

## Security
- The function uses a simple hash comparison (demo app, not production-grade).
- For production, replace with bcrypt/argon2 via a Supabase Edge Function.
- The function is SECURITY DEFINER so it can read password_hash which would
  otherwise be inaccessible if we restrict the column.
*/

-- Add password_hash column
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS password_hash text;

-- Create a simple hash function (demo only — not for production)
-- Uses pgcrypto's digest for a SHA-256 hash
CREATE OR REPLACE FUNCTION hash_password(raw_password text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(digest(raw_password, 'sha256'), 'hex')
$$;

-- Set passwords for existing demo users
-- admin@brigade189.idf → admin123
-- battalion.admin@brigade189.idf → battalion123
-- company.admin@brigade189.idf → company123
UPDATE system_users SET password_hash = hash_password('admin123') WHERE email = 'admin@brigade189.idf';
UPDATE system_users SET password_hash = hash_password('battalion123') WHERE email = 'battalion.admin@brigade189.idf';
UPDATE system_users SET password_hash = hash_password('company123') WHERE email = 'company.admin@brigade189.idf';

-- Create login verification function
-- SECURITY DEFINER so it bypasses any column-level restrictions
DROP FUNCTION IF EXISTS verify_system_user_login(text, text);
CREATE OR REPLACE FUNCTION verify_system_user_login(
  login_email text,
  login_password text
)
RETURNS system_users
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM system_users
  WHERE email = login_email
    AND password_hash = hash_password(login_password)
    AND is_active = true
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION verify_system_user_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION hash_password(text) TO anon, authenticated;

-- Allow updating password_hash via the normal update policy (already has anon update policy)
