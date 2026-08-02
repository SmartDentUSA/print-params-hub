DO $$
DECLARE r RECORD; def TEXT; newdef TEXT;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='copilot_brain' AND p.prosrc ~ 'DELETE FROM copilot_brain\.[a-z_]+\s*;'
  LOOP
    def := pg_get_functiondef(r.oid);
    newdef := regexp_replace(def, 'DELETE FROM copilot_brain\.([a-z_]+)\s*;', 'DELETE FROM copilot_brain.\1 WHERE true;', 'g');
    IF newdef <> def THEN EXECUTE newdef; END IF;
  END LOOP;
END $$;