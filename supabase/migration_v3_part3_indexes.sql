-- Part 3: Performans indeksleri
-- Supabase SQL Editor > Run (▶) ile çalıştır

CREATE INDEX IF NOT EXISTS idx_alerts_user_id    ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type       ON alerts(type);
