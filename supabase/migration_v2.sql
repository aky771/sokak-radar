-- ============================================================
-- SOKAK RADAR - v2 Migration
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- Alerts tablosuna yeni sütunlar ekle
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS like_count    INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS address       TEXT;

-- Profiles tablosuna yeni sütunlar ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#6366f1';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Alerts güncelleme politikası (oy sayıları için)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'Vote fonksiyonu alerts güncelleyebilir'
  ) THEN
    EXECUTE 'CREATE POLICY "Vote fonksiyonu alerts güncelleyebilir" ON alerts FOR UPDATE USING (true)';
  END IF;
END $$;

-- ============================================================
-- ALERT_VOTES TABLOSU
-- Her kullanıcı her uyarıya bir kez like veya dislike atabilir
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type  TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alert_id, user_id)
);

ALTER TABLE alert_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_votes' AND policyname='Herkes oyları görebilir') THEN
    EXECUTE 'CREATE POLICY "Herkes oyları görebilir" ON alert_votes FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_votes' AND policyname='Auth kullanıcılar oy verebilir') THEN
    EXECUTE 'CREATE POLICY "Auth kullanıcılar oy verebilir" ON alert_votes FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_votes' AND policyname='Kullanıcı kendi oyunu değiştirebilir') THEN
    EXECUTE 'CREATE POLICY "Kullanıcı kendi oyunu değiştirebilir" ON alert_votes FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_votes' AND policyname='Kullanıcı kendi oyunu silebilir') THEN
    EXECUTE 'CREATE POLICY "Kullanıcı kendi oyunu silebilir" ON alert_votes FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ============================================================
-- OY VERME FONKSİYONU
-- like/dislike toggle, 8+ dislike = uyarı silinir
-- ============================================================
CREATE OR REPLACE FUNCTION vote_on_alert(p_alert_id UUID, p_vote_type TEXT)
RETURNS JSON AS $$
DECLARE
  existing_vote  TEXT;
  v_like_count   INTEGER;
  v_dislike_count INTEGER;
  v_user_vote    TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Giriş yapmanız gerekiyor';
  END IF;

  -- Mevcut oyu kontrol et
  SELECT vote_type INTO existing_vote
  FROM alert_votes
  WHERE alert_id = p_alert_id AND user_id = auth.uid();

  IF existing_vote IS NULL THEN
    INSERT INTO alert_votes (alert_id, user_id, vote_type)
    VALUES (p_alert_id, auth.uid(), p_vote_type);
    v_user_vote := p_vote_type;
  ELSIF existing_vote = p_vote_type THEN
    -- Aynı butona tekrar basınca oyu kaldır (toggle)
    DELETE FROM alert_votes WHERE alert_id = p_alert_id AND user_id = auth.uid();
    v_user_vote := NULL;
  ELSE
    -- Farklı oya geç
    UPDATE alert_votes SET vote_type = p_vote_type
    WHERE alert_id = p_alert_id AND user_id = auth.uid();
    v_user_vote := p_vote_type;
  END IF;

  -- Güncel sayıları hesapla
  SELECT
    COUNT(*) FILTER (WHERE vote_type = 'like'),
    COUNT(*) FILTER (WHERE vote_type = 'dislike')
  INTO v_like_count, v_dislike_count
  FROM alert_votes WHERE alert_id = p_alert_id;

  -- Uyarıdaki sayıları güncelle
  UPDATE alerts
  SET like_count = v_like_count, dislike_count = v_dislike_count
  WHERE id = p_alert_id;

  -- 8+ dislike: uyarıyı kaldır
  IF v_dislike_count >= 8 THEN
    DELETE FROM alerts WHERE id = p_alert_id;
    RETURN json_build_object(
      'like_count', v_like_count, 'dislike_count', v_dislike_count,
      'user_vote', NULL, 'deleted', true
    );
  END IF;

  RETURN json_build_object(
    'like_count', v_like_count, 'dislike_count', v_dislike_count,
    'user_vote', v_user_vote, 'deleted', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- KULLANICI OY LİSTESİ
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_votes(p_alert_ids UUID[])
RETURNS TABLE(alert_id UUID, vote_type TEXT) AS $$
  SELECT alert_id, vote_type
  FROM alert_votes
  WHERE alert_id = ANY(p_alert_ids) AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- REALTIME: alert_votes tablosu
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE alert_votes;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
