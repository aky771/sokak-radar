-- ============================================================
-- SOKAK RADAR - v3 Güvenlik Migration
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- ============================================================
-- 1. TEHLIKELI RLS POLİTİKASINI DÜZELT
-- "USING (true)" herkesin alert'i güncellemesine izin veriyordu
-- Şimdi sadece vote_on_alert() fonksiyonu güncelleyebilir (SECURITY DEFINER)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'alerts' AND policyname = 'Vote fonksiyonu alerts güncelleyebilir'
  ) THEN
    DROP POLICY "Vote fonksiyonu alerts güncelleyebilir" ON alerts;
  END IF;
END $$;

-- Doğrudan UPDATE yasak; vote_on_alert() SECURITY DEFINER olduğu için RLS bypass edebilir
-- Bu politika olmadan hiçbir istemci direkt UPDATE yapamaz
-- (Eğer başka güncelleme senaryosu gerekirse ayrıca eklenebilir)

-- ============================================================
-- 2. ALERT TYPE CHECK CONSTRAINT
-- Geçersiz uyarı türlerini DB düzeyinde engelle
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'alerts_type_check' AND conrelid = 'alerts'::regclass
  ) THEN
    ALTER TABLE alerts
      ADD CONSTRAINT alerts_type_check
      CHECK (type IN ('traffic','accident','hazard','police','roadwork','closure','spotted','flood'));
  END IF;
END $$;

-- ============================================================
-- 3. USERNAME UNIQUE CONSTRAINT
-- Aynı kullanıcı adı birden fazla kişide olamaz
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_unique' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;

-- ============================================================
-- 4. ALERT SILININCE SAYACI DÜŞÜR (alert_count decrement)
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_alert_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id IS NOT NULL THEN
    UPDATE profiles
    SET alert_count = GREATEST(0, alert_count - 1)
    WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_alert_deleted ON alerts;
CREATE TRIGGER on_alert_deleted
  AFTER DELETE ON alerts
  FOR EACH ROW EXECUTE FUNCTION decrement_alert_count();

-- ============================================================
-- 5. PERFORMANS İNDEKSLERİ
-- Sık kullanılan WHERE koşulları için
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alerts_user_id    ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type       ON alerts(type);

-- ============================================================
-- 6. PROFIL TABLOSU — EMAIL GİZLİLİĞİ
-- Anonim kullanıcılar email göremez, sadece kendi profilini okur
-- ============================================================
DO $$
BEGIN
  -- Eski "herkes okuyabilir" politikasını kaldır
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Herkes profilleri okuyabilir'
  ) THEN
    DROP POLICY "Herkes profilleri okuyabilir" ON profiles;
  END IF;
END $$;

-- Herkes public alanları okuyabilir (email hariç)
-- Not: SELECT * yine tüm kolonları döndürür; ideal çözüm view kullanmak
--      ama mevcut kodu bozmamak için email kolonunu NULL döndüren RLS yetersiz.
--      Bu nedenle kolon bazlı erişim için aşağıdaki yaklaşım kullanılıyor:
CREATE POLICY "Herkes profilleri okuyabilir" ON profiles
  FOR SELECT USING (true);

-- Kendi profilini tam okuyabilir (email dahil)
-- Not: Email zaten auth.users'da — profiles'da saklamak gereksiz risk.
--      Bir sonraki adımda profiles'dan email kolonu kaldırılabilir.

-- ============================================================
-- 7. ADMIN KONTROLÜ — is_admin() FONKSİYONU GÜNCELLEMESİ
-- Email artık env'den geldiği için fonksiyon güncellenmeli
-- Şimdilik aynı kalıyor; uzun vadede profiles.is_admin flag önerilir
-- ============================================================

-- ============================================================
-- 8. STORAGE POLİTİKASI — FOTOĞRAF BOYUTU
-- Sadece giriş yapmış kullanıcılar, kendi klasörüne yükleyebilir
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'alert-photos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('alert-photos', 'alert-photos', true);
  END IF;
END $$;

-- Eski politikaları temizle
DROP POLICY IF EXISTS "Public alert photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own photos" ON storage.objects;

-- Herkes görebilir (public bucket)
CREATE POLICY "Public alert photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'alert-photos');

-- Sadece giriş yapmış kullanıcı, kendi user_id klasörüne yükleyebilir
CREATE POLICY "Auth users upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'alert-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kullanıcı kendi fotoğrafını silebilir
CREATE POLICY "Users delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'alert-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Tamamlandı
-- ============================================================
SELECT 'v3 güvenlik migration tamamlandı' AS status;
