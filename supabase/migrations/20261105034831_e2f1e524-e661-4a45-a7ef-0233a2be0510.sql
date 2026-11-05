CREATE TABLE public.lead_merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  dup_id uuid NOT NULL,
  canonical_id uuid NOT NULL,
  reason text NOT NULL,
  relinked jsonb NOT NULL DEFAULT '{}'::jsonb,
  skipped jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_merge_audit TO service_role;
ALTER TABLE public.lead_merge_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_merge_lead_into(p_dup uuid, p_canon uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n bigint; rel jsonb := '{}'; sk jsonb := '{}';
BEGIN
  IF p_dup = p_canon THEN RETURN jsonb_build_object('error','self'); END IF;
  FOR r IN SELECT k.conrelid::regclass::text t, a.attname c
    FROM pg_constraint k JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey)
    WHERE k.contype='f' AND k.confrelid='public.lia_attendances'::regclass AND NOT (k.conrelid='public.lia_attendances'::regclass)
  LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I=$1 WHERE %I=$2', r.t, r.c, r.c) USING p_canon, p_dup;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n>0 THEN rel := rel || jsonb_build_object(r.t||'.'||r.c, n); END IF;
    EXCEPTION WHEN others THEN
      sk := sk || jsonb_build_object(r.t||'.'||r.c, SQLERRM);
    END;
  END LOOP;
  UPDATE lia_attendances SET merged_into = p_dup WHERE merged_into = p_dup AND false; -- noop guard
  UPDATE lia_attendances SET merged_into = p_canon WHERE merged_into = p_dup;
  UPDATE lia_attendances SET merged_into = p_canon, lead_status = 'merged' WHERE id = p_dup;
  RETURN jsonb_build_object('relinked', rel, 'skipped', sk);
END $$;
REVOKE ALL ON FUNCTION public.fn_merge_lead_into(uuid,uuid) FROM public, anon, authenticated;

-- Candidatos
WITH b AS (
  SELECT id, nome, email, piperun_id, created_at, empresa_nome,
    regexp_replace(coalesce(pessoa_cpf,''),'\D','','g') cpf,
    regexp_replace(coalesce(empresa_cnpj,''),'\D','','g') cnpj,
    regexp_split_to_array(trim(regexp_replace(lower(translate(coalesce(nome,''),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc')),'[^a-z ]','','g')),'\s+') tk,
    trim(regexp_replace(lower(translate(coalesce(nome,''),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc')),'[^a-z]','','g')) nn,
    trim(regexp_replace(lower(translate(coalesce(empresa_nome,''),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc')),'[^a-z]','','g')) en
  FROM lia_attendances WHERE merged_into IS NULL
),
cpf AS (SELECT *, count(*) OVER (PARTITION BY cpf) n,
  row_number() OVER (PARTITION BY cpf ORDER BY (piperun_id IS NOT NULL) DESC, (email IS NOT NULL AND email NOT LIKE '%placeholder%') DESC, created_at) rk
  FROM b WHERE length(cpf)=11),
cpf_pairs AS (SELECT d.id dup, c.id canon, 'cpf:'||d.cpf reason FROM cpf d JOIN cpf c ON c.cpf=d.cpf AND c.rk=1
  WHERE d.rk>1 AND d.tk[1]=c.tk[1] AND d.tk[array_length(d.tk,1)]=c.tk[array_length(c.tk,1)]),
cn AS (SELECT *, ((email IS NULL OR email LIKE '%placeholder%') AND (nome IS NULL OR nome ILIKE 'nome n%' OR nn=en OR (en<>'' AND position(nn in en)>0 AND length(nn)>=3) OR nome ~* '\m(ltda|eireli|epp|sociedade|s/s)\M')) stub
  FROM b WHERE length(cnpj)=14 AND id NOT IN (SELECT dup FROM cpf_pairs)),
grp AS (SELECT cnpj, count(*) FILTER (WHERE NOT stub) persons, count(*) FILTER (WHERE stub) stubs FROM cn GROUP BY cnpj),
cnpj_pairs AS (SELECT s.id dup, p.id canon, 'cnpj_empresa:'||s.cnpj reason
  FROM cn s JOIN grp g ON g.cnpj=s.cnpj AND g.persons=1 AND s.stub
  JOIN cn p ON p.cnpj=s.cnpj AND NOT p.stub)
INSERT INTO public.lead_merge_audit(batch, dup_id, canonical_id, reason)
SELECT '20261105_cpf_cnpj', dup, canon, reason FROM (SELECT * FROM cpf_pairs UNION ALL SELECT * FROM cnpj_pairs) x
WHERE dup NOT IN (SELECT canon FROM cpf_pairs UNION SELECT canon FROM cnpj_pairs);

DO $$ DECLARE r record; res jsonb; BEGIN
  FOR r IN SELECT id, dup_id, canonical_id FROM public.lead_merge_audit WHERE batch='20261105_cpf_cnpj' AND status='pending' LOOP
    res := public.fn_merge_lead_into(r.dup_id, r.canonical_id);
    UPDATE public.lead_merge_audit SET relinked=res->'relinked', skipped=res->'skipped', status='done' WHERE id=r.id;
  END LOOP;
END $$;