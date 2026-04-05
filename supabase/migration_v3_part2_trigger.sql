-- Part 2: Alert silinince alert_count düşür
-- Supabase SQL Editor > Run (▶) ile çalıştır

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
