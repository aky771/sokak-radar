-- Admin kolonu: profiles tablosuna is_admin ekle
-- Supabase SQL Editor > Run (▶) ile çalıştır

-- 1. is_admin kolonu ekle (yoksa)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Admin kullanıcısını işaretle
UPDATE profiles SET is_admin = TRUE WHERE email = 'ayardm62@gmail.com';

-- 3. Sadece servis rolü is_admin değiştirebilir (RLS güvenliği)
DROP POLICY IF EXISTS "Admin flag only by service role" ON profiles;
CREATE POLICY "Admin flag only by service role"
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (
    is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
    OR current_setting('role') = 'service_role'
  );
