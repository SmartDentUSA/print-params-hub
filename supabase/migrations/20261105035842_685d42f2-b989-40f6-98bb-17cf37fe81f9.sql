DO $$ DECLARE m record; t text; c text; r record; moved int; kept int; BEGIN
FOR m IN SELECT id, dup_id, canonical_id, skipped FROM public.lead_merge_audit WHERE batch='20261105_cpf_cnpj' AND skipped<>'{}'::jsonb LOOP
  moved:=0; kept:=0;
  FOR t, c IN SELECT split_part(k,'.',1), split_part(k,'.',2) FROM jsonb_object_keys(m.skipped) k LOOP
    FOR r IN EXECUTE format('SELECT ctid AS x FROM %s WHERE %I=$1', t, c) USING m.dup_id LOOP
      BEGIN
        EXECUTE format('UPDATE %s SET %I=$1 WHERE ctid=$2', t, c) USING m.canonical_id, r.x;
        moved:=moved+1;
      EXCEPTION WHEN unique_violation THEN kept:=kept+1;
      END;
    END LOOP;
  END LOOP;
  UPDATE public.lead_merge_audit SET relinked = relinked || jsonb_build_object('row_pass_moved',moved,'row_pass_kept_duplicate',kept) WHERE id=m.id;
END LOOP; END $$;