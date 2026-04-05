-- ============================================================
-- SOKAK RADAR - v5 Profil Backfill + Admin Kullanıcı Listesi
-- Supabase Dashboard > SQL Editor > Run ile çalıştırın
-- ============================================================

-- 1. auth.users'da olup profiles tablosunda OLMAYAN kullanıcıları doldur
--    (trigger kurulmadan önce kayıt olanlar için)
INSERT INTO profiles (id, email, username)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'username',
    SPLIT_PART(COALESCE(u.email, ''), '@', 1),
    'kullanici'
  )
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 2. Admin için tüm kullanıcıları döndüren güvenli fonksiyon
--    (auth.users'a doğrudan client erişimi yoktur; bu fonksiyon service-definer olarak çalışır)
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS TABLE (
  id          UUID,
  email       TEXT,
  username    TEXT,
  display_name TEXT,
  bio         TEXT,
  avatar_color TEXT,
  is_blocked  BOOLEAN,
  is_admin    BOOLEAN,
  alert_count INTEGER,
  created_at  TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(p.username, SPLIT_PART(u.email, '@', 1))::TEXT,
    p.display_name,
    p.bio,
    p.avatar_color,
    COALESCE(p.is_blocked, FALSE),
    COALESCE(p.is_admin, FALSE),
    COALESCE(p.alert_count, 0),
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
