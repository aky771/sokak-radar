-- Part 1: RLS & Constraint fixes
-- Supabase SQL Editor > Run (▶) ile çalıştır

-- Tehlikeli UPDATE politikasını kaldır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alerts' AND policyname = 'Vote fonksiyonu alerts güncelleyebilir'
  ) THEN
    DROP POLICY "Vote fonksiyonu alerts güncelleyebilir" ON alerts;
  END IF;
END $$;

-- Alert type CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alerts_type_check' AND conrelid = 'alerts'::regclass
  ) THEN
    ALTER TABLE alerts ADD CONSTRAINT alerts_type_check
      CHECK (type IN ('traffic','accident','hazard','police','roadwork','closure','spotted','flood'));
  END IF;
END $$;

-- Username UNIQUE constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_unique' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;
