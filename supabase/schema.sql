-- ============================================================
-- SOKAK RADAR - Supabase Schema
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- Admin kontrol fonksiyonu
-- ÖNEMLİ: Aşağıdaki e-posta adresini kendi admin e-postanızla değiştirin.
-- Bu fonksiyon sunucu tarafında çalışır; istemci bundle'ına dahil edilmez.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT email = 'ayardm62@gmail.com'
  FROM auth.users
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES TABLOSU
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  alert_count INTEGER DEFAULT 0
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes profilleri okuyabilir" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Kullanıcı kendi profilini güncelleyebilir" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin tüm profilleri güncelleyebilir" ON profiles
  FOR UPDATE USING (is_admin());

-- Profiles INSERT policy (client-side upsert için gerekli)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Kullanıcı kendi profilini oluşturabilir'
  ) THEN
    EXECUTE 'CREATE POLICY "Kullanıcı kendi profilini oluşturabilir" ON profiles FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

-- Kayıt olunca otomatik profil oluştur
-- EXCEPTION bloğu: profil oluşturma hatası kaydı engellemez
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO profiles (id, email, username)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Hata olsa bile kayıt tamamlanır
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ALERTS TABLOSU
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'spotted',
  description TEXT,
  photo_url TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT DEFAULT 'Kullanıcı',
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '12 hours'
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Herkese aktif uyarıları göster (bloklu kullanıcıların uyarıları hariç)
CREATE POLICY "Aktif uyarıları herkes görebilir" ON alerts
  FOR SELECT USING (
    expires_at > NOW() AND
    (
      user_id IS NULL OR
      NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = alerts.user_id AND is_blocked = true
      )
    )
  );

-- Oturum açmış ve bloklu olmayan kullanıcılar uyarı ekleyebilir
CREATE POLICY "Auth kullanıcılar uyarı ekleyebilir" ON alerts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_blocked = true
    )
  );

-- Kullanıcılar kendi uyarılarını silebilir
CREATE POLICY "Kullanıcı kendi uyarısını silebilir" ON alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Admin tüm uyarıları silebilir
CREATE POLICY "Admin tüm uyarıları silebilir" ON alerts
  FOR DELETE USING (is_admin());

-- Oy artırma fonksiyonu
CREATE OR REPLACE FUNCTION increment_vote(alert_id UUID)
RETURNS void AS $$
  UPDATE alerts SET votes = votes + 1 WHERE id = alert_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Uyarı eklenince kullanıcının sayacını artır
CREATE OR REPLACE FUNCTION update_alert_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE profiles SET alert_count = alert_count + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_alert_created ON alerts;
CREATE TRIGGER on_alert_created
  AFTER INSERT ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_alert_count();

-- ============================================================
-- ADMIN FONKSİYONLARI
-- ============================================================

-- Kullanıcı blokla/blok kaldır
CREATE OR REPLACE FUNCTION admin_block_user(target_id UUID, block_status BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Yetkisiz erişim'; END IF;
  UPDATE profiles SET is_blocked = block_status WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kullanıcının tüm uyarılarını sil
CREATE OR REPLACE FUNCTION admin_delete_user_alerts(target_id UUID)
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Yetkisiz erişim'; END IF;
  DELETE FROM alerts WHERE user_id = target_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  UPDATE profiles SET alert_count = 0 WHERE id = target_id;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Süresi dolmuş uyarıları temizle
CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM alerts WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;

-- ============================================================
-- STORAGE (alert-photos bucket)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('alert-photos', 'alert-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Herkes fotoğraf görebilir" ON storage.objects
  FOR SELECT USING (bucket_id = 'alert-photos');

CREATE POLICY "Auth kullanıcılar fotoğraf yükleyebilir" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'alert-photos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Kullanıcı kendi fotoğrafını silebilir" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'alert-photos' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- ADMİN KULLANICI
-- Admin paneline giriş için Supabase Dashboard > Authentication >
-- Users > "Add user" ile ayardm62@gmail.com / şifre:1234567 ekleyin
-- ============================================================
