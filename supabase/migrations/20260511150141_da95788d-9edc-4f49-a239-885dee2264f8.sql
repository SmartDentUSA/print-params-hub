-- ============================================================
-- Equipment brand distribution RPCs + noise cleanup
-- ============================================================

-- 1) Cleanup noisy values written by the Piperun deal_items backfill
--    (HTML fragments, course descriptions, accessories, chemical descriptions)
DO $$
DECLARE
  v_noise_re text := '(<span|<p\s|<div|wdyuqq|text-decoration|imers[ãa]o|curso|treinamento|workshop|kit|jogo de pontas|cabo |ponta(s)? para|insumo|resina|fresa|teflon|fep|ponto de fulgor|densidade|corros[ãa]o|enxofre|cloro|pel[íi]cula|skd-s2|aprimorando a superf|propriedades [óo]pticas)';
BEGIN
  UPDATE public.lia_attendances
     SET equip_scanner = NULL
   WHERE merged_into IS NULL
     AND equip_scanner IS NOT NULL
     AND equip_scanner ~* v_noise_re;

  UPDATE public.lia_attendances
     SET equip_impressora = NULL
   WHERE merged_into IS NULL
     AND equip_impressora IS NOT NULL
     AND equip_impressora ~* v_noise_re;

  UPDATE public.lia_attendances
     SET impressora_modelo = NULL
   WHERE merged_into IS NULL
     AND impressora_modelo IS NOT NULL
     AND impressora_modelo ~* v_noise_re;
END $$;

-- 2) Brand normalizer for scanners
CREATE OR REPLACE FUNCTION public.fn_normalize_scanner_brand(p_raw text)
RETURNS TABLE(brand text, model text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := lower(coalesce(p_raw, ''));
BEGIN
  IF v = '' THEN RETURN; END IF;

  -- SmartDent BLZ
  IF v ~ 'blz.*(ino\s*200|ino200)' OR v ~ 'ino\s*200' THEN
    RETURN QUERY SELECT 'SmartDent BLZ'::text, 'INO 200'::text; RETURN;
  ELSIF v ~ 'blz.*(ino\s*100|ino100)' OR v ~ 'ino\s*100' THEN
    RETURN QUERY SELECT 'SmartDent BLZ'::text, 'INO 100'::text; RETURN;
  ELSIF v ~ 'blz.*(ls\s*100|ls100)' OR v ~ 'ls\s*100' THEN
    RETURN QUERY SELECT 'SmartDent BLZ'::text, 'LS 100'::text; RETURN;
  ELSIF v ~ 'blz' THEN
    RETURN QUERY SELECT 'SmartDent BLZ'::text, NULL::text; RETURN;

  -- Medit
  ELSIF v ~ 'i\s*900' OR v ~ 'medit.*900' THEN
    RETURN QUERY SELECT 'Medit'::text, 'i900'::text; RETURN;
  ELSIF v ~ 'i\s*700' OR v ~ 'medit.*700' THEN
    RETURN QUERY SELECT 'Medit'::text, 'i700'::text; RETURN;
  ELSIF v ~ 'i\s*600' OR v ~ 'medit.*600' THEN
    RETURN QUERY SELECT 'Medit'::text, 'i600'::text; RETURN;
  ELSIF v ~ 'i\s*500' OR v ~ 'medit.*500' THEN
    RETURN QUERY SELECT 'Medit'::text, 'i500'::text; RETURN;
  ELSIF v ~ 't\s*310' OR v ~ 'medit.*310' THEN
    RETURN QUERY SELECT 'Medit'::text, 'T310 (bancada)'::text; RETURN;
  ELSIF v ~ 'medit' THEN
    RETURN QUERY SELECT 'Medit'::text, NULL::text; RETURN;

  -- 3Shape
  ELSIF v ~ 'trios\s*5' THEN
    RETURN QUERY SELECT '3Shape'::text, 'Trios 5'::text; RETURN;
  ELSIF v ~ 'trios\s*4' THEN
    RETURN QUERY SELECT '3Shape'::text, 'Trios 4'::text; RETURN;
  ELSIF v ~ 'trios\s*3' THEN
    RETURN QUERY SELECT '3Shape'::text, 'Trios 3'::text; RETURN;
  ELSIF v ~ 'trios|3\s*shape|3shape' THEN
    RETURN QUERY SELECT '3Shape'::text, 'Trios'::text; RETURN;

  -- iTero
  ELSIF v ~ 'itero|i\s*tero|align' THEN
    RETURN QUERY SELECT 'Align iTero'::text, NULLIF(regexp_replace(v, '.*itero\s*', '', 'i'), v); RETURN;

  -- Carestream
  ELSIF v ~ 'cs\s*3700|carestream.*3700' THEN
    RETURN QUERY SELECT 'Carestream'::text, 'CS 3700'::text; RETURN;
  ELSIF v ~ 'cs\s*3600|carestream.*3600' THEN
    RETURN QUERY SELECT 'Carestream'::text, 'CS 3600'::text; RETURN;
  ELSIF v ~ 'carestream' THEN
    RETURN QUERY SELECT 'Carestream'::text, NULL::text; RETURN;

  -- Sirona / Cerec
  ELSIF v ~ 'cerec|sirona|primescan|omnicam' THEN
    RETURN QUERY SELECT 'Dentsply Sirona'::text, 'Cerec'::text; RETURN;

  -- Straumann
  ELSIF v ~ 'virtuo' THEN
    RETURN QUERY SELECT 'Straumann'::text, 'Virtuo Vivo'::text; RETURN;
  ELSIF v ~ 'sirius' THEN
    RETURN QUERY SELECT 'Straumann'::text, 'Sirius'::text; RETURN;
  ELSIF v ~ 'straumann' THEN
    RETURN QUERY SELECT 'Straumann'::text, NULL::text; RETURN;

  -- Outros
  ELSIF v ~ 'shining|shinnig' THEN
    RETURN QUERY SELECT 'Shining 3D'::text, NULL::text; RETURN;
  ELSIF v ~ 'dexis' THEN
    RETURN QUERY SELECT 'Dexis'::text, NULL::text; RETURN;
  ELSIF v ~ 'planmeca' THEN
    RETURN QUERY SELECT 'Planmeca'::text, NULL::text; RETURN;
  ELSIF v ~ 'condor' THEN
    RETURN QUERY SELECT 'Condor'::text, NULL::text; RETURN;
  ELSIF v ~ 'gnatus' THEN
    RETURN QUERY SELECT 'Gnatus'::text, NULL::text; RETURN;
  ELSIF v ~ 'dental wings|dentalwings' THEN
    RETURN QUERY SELECT 'Dental Wings'::text, NULL::text; RETURN;
  ELSIF v ~ 'n[aã]o\s*(tenho|digitalizo|possu)' OR v ~ 'sem scanner|nenhum' THEN
    RETURN QUERY SELECT 'Sem scanner'::text, NULL::text; RETURN;
  ELSE
    RETURN QUERY SELECT 'Outros'::text, NULL::text; RETURN;
  END IF;
END $$;

-- 3) Brand normalizer for 3D printers
CREATE OR REPLACE FUNCTION public.fn_normalize_printer_brand(p_raw text)
RETURNS TABLE(brand text, model text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := lower(coalesce(p_raw, ''));
BEGIN
  IF v = '' THEN RETURN; END IF;

  IF v ~ 'rayshape.*edge\s*mini' THEN
    RETURN QUERY SELECT 'RayShape'::text, 'Edge Mini'::text; RETURN;
  ELSIF v ~ 'rayshape' THEN
    RETURN QUERY SELECT 'RayShape'::text, NULL::text; RETURN;
  ELSIF v ~ 'halot.*one\s*pro' THEN
    RETURN QUERY SELECT 'Creality'::text, 'Halot One Pro'::text; RETURN;
  ELSIF v ~ 'halot' THEN
    RETURN QUERY SELECT 'Creality'::text, 'Halot'::text; RETURN;
  ELSIF v ~ 'mars\s*5\s*ultra' THEN
    RETURN QUERY SELECT 'Elegoo'::text, 'Mars 5 Ultra'::text; RETURN;
  ELSIF v ~ 'mars.*ultra.*9k|mars.*9k' THEN
    RETURN QUERY SELECT 'Elegoo'::text, 'Mars Ultra 9K'::text; RETURN;
  ELSIF v ~ 'saturn' THEN
    RETURN QUERY SELECT 'Elegoo'::text, 'Saturn'::text; RETURN;
  ELSIF v ~ 'mars' OR v ~ 'elegoo' THEN
    RETURN QUERY SELECT 'Elegoo'::text, NULL::text; RETURN;
  ELSIF v ~ 'phrozen.*sonic.*mini.*8k' THEN
    RETURN QUERY SELECT 'Phrozen'::text, 'Sonic Mini 8K'::text; RETURN;
  ELSIF v ~ 'phrozen' THEN
    RETURN QUERY SELECT 'Phrozen'::text, NULL::text; RETURN;
  ELSIF v ~ 'anycubic' THEN
    RETURN QUERY SELECT 'Anycubic'::text, NULL::text; RETURN;
  ELSIF v ~ 'formlabs|form\s*[23]' THEN
    RETURN QUERY SELECT 'Formlabs'::text, NULL::text; RETURN;
  ELSIF v ~ 'asiga' THEN
    RETURN QUERY SELECT 'Asiga'::text, NULL::text; RETURN;
  ELSIF v ~ 'sprintray' THEN
    RETURN QUERY SELECT 'SprintRay'::text, NULL::text; RETURN;
  ELSIF v ~ 'n[aã]o\s*(tenho|possu)' OR v ~ 'sem impressora|nenhuma' THEN
    RETURN QUERY SELECT 'Sem impressora'::text, NULL::text; RETURN;
  ELSE
    RETURN QUERY SELECT 'Outros'::text, NULL::text; RETURN;
  END IF;
END $$;

-- 4) Aggregated RPC for scanner distribution
CREATE OR REPLACE FUNCTION public.query_scanner_brand_distribution()
RETURNS TABLE(brand text, model text, lead_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT n.brand, n.model, COUNT(*)::bigint AS lead_count
    FROM public.lia_attendances la
    CROSS JOIN LATERAL public.fn_normalize_scanner_brand(la.equip_scanner) n
   WHERE la.merged_into IS NULL
     AND la.equip_scanner IS NOT NULL
     AND la.equip_scanner <> ''
   GROUP BY n.brand, n.model
   ORDER BY lead_count DESC, n.brand, n.model NULLS LAST;
$$;

-- 5) Aggregated RPC for printer distribution
--    Uses both equip_impressora and impressora_modelo (whichever has data)
CREATE OR REPLACE FUNCTION public.query_printer_brand_distribution()
RETURNS TABLE(brand text, model text, lead_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH src AS (
    SELECT COALESCE(NULLIF(equip_impressora, ''), NULLIF(impressora_modelo, '')) AS raw
      FROM public.lia_attendances
     WHERE merged_into IS NULL
       AND COALESCE(NULLIF(equip_impressora, ''), NULLIF(impressora_modelo, '')) IS NOT NULL
  )
  SELECT n.brand, n.model, COUNT(*)::bigint AS lead_count
    FROM src
    CROSS JOIN LATERAL public.fn_normalize_printer_brand(src.raw) n
   GROUP BY n.brand, n.model
   ORDER BY lead_count DESC, n.brand, n.model NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.query_scanner_brand_distribution() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.query_printer_brand_distribution() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_normalize_scanner_brand(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_normalize_printer_brand(text) TO anon, authenticated, service_role;