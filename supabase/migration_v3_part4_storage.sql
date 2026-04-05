-- Part 4: Storage politikaları
-- Supabase SQL Editor > Run (▶) ile çalıştır

-- Bucket yoksa oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('alert-photos', 'alert-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Eski politikaları temizle
DROP POLICY IF EXISTS "Public alert photos"     ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own photos"  ON storage.objects;

-- Herkes görebilir
CREATE POLICY "Public alert photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'alert-photos');

-- Sadece kendi klasörüne yükleyebilir
CREATE POLICY "Auth users upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'alert-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kendi fotoğrafını silebilir
CREATE POLICY "Users delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'alert-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
