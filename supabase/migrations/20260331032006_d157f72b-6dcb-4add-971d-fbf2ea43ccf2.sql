-- ═══════════════════════════════════════════════════════
-- BLOCO 1: 17 colunas de enriquecimento financeiro
-- ═══════════════════════════════════════════════════════
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS omie_faturamento_total  numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_valor_pago         numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_valor_em_aberto    numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_valor_vencido      numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_percentual_pago    numeric(6,1)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_ticket_medio       numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_frequencia_compra  integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_ultima_compra      date,
  ADD COLUMN IF NOT EXISTS omie_dias_sem_comprar   integer,
  ADD COLUMN IF NOT EXISTS omie_inadimplente       boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS omie_dias_atraso_max    integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_score              integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_total_pedidos      integer  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omie_ultima_nf_emitida  date,
  ADD COLUMN IF NOT EXISTS omie_tipo_pessoa        text,
  ADD COLUMN IF NOT EXISTS omie_segmento           text,
  ADD COLUMN IF NOT EXISTS omie_razao_social       text,
  ADD COLUMN IF NOT EXISTS omie_classificacao      text;

CREATE INDEX IF NOT EXISTS idx_lia_omie_score
  ON lia_attendances(omie_score DESC)
  WHERE omie_score > 0;

CREATE INDEX IF NOT EXISTS idx_lia_omie_inadimplente
  ON lia_attendances(omie_inadimplente)
  WHERE omie_inadimplente = true;

-- ═══════════════════════════════════════════════════════
-- BLOCO 2: real_status — trigger-based (não GENERATED)
-- Trigger recalcula em CADA update, evitando inconsistência
-- quando fn_enrich_lead_from_omie altera omie_inadimplente
-- ═══════════════════════════════════════════════════════
ALTER TABLE lia_attendances DROP COLUMN IF EXISTS real_status;
ALTER TABLE lia_attendances ADD COLUMN real_status text;

CREATE OR REPLACE FUNCTION fn_set_real_status()
RETURNS trigger AS $$
BEGIN
  NEW.real_status :=
    CASE
      WHEN NEW.omie_inadimplente = true
        AND COALESCE(NEW.erp_status,'NONE') NOT IN ('CANCELADO','DEVOLVIDO')
        THEN 'INADIMPLENTE'
      WHEN NEW.frete_status IN ('DEVOLVIDO','EXTRAVIADO')
        THEN 'DEAL_PERDIDO'
      WHEN NEW.erp_status IN ('CANCELADO','DEVOLVIDO')
        THEN 'DEAL_PERDIDO'
      WHEN NEW.erp_status = 'INADIMPLENTE'
        THEN 'INADIMPLENTE'
      WHEN NEW.erp_status = 'PAGO'
        AND COALESCE(NEW.frete_status,'NONE') IN ('ENTREGUE','NONE')
        THEN 'CLIENTE_ATIVO'
      WHEN NEW.erp_status = 'PAGO'
        AND COALESCE(NEW.frete_status,'NONE') NOT IN ('ENTREGUE','NONE')
        THEN 'AGUARDANDO_ENTREGA'
      WHEN NEW.frete_status = 'EM_TRANSITO'
        THEN 'EM_TRANSITO'
      WHEN NEW.erp_status IN ('FATURADO','PARCIALMENTE_PAGO')
        THEN 'AGUARDANDO_PAGAMENTO'
      WHEN NEW.status_oportunidade = 'ganha'
        AND (NEW.erp_status IS NULL OR NEW.erp_status = 'NONE')
        THEN 'RISCO_OPERACIONAL'
      WHEN NEW.status_oportunidade = 'perdida'
        THEN 'NEGOCIO_PERDIDO'
      ELSE 'EM_NEGOCIACAO'
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_real_status ON lia_attendances;
CREATE TRIGGER trg_real_status
  BEFORE INSERT OR UPDATE ON lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_real_status();

-- Backfill existing rows
UPDATE lia_attendances SET real_status = real_status WHERE real_status IS NULL;

-- ═══════════════════════════════════════════════════════
-- BLOCO 3: fn_omie_score_label — IMMUTABLE
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_omie_score_label(score integer)
RETURNS text AS $$
BEGIN
  RETURN CASE
    WHEN score >= 80 THEN 'PREMIUM'
    WHEN score >= 50 THEN 'ATIVO'
    WHEN score >= 20 THEN 'OPORTUNIDADE'
    ELSE 'RISCO'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════
-- BLOCO 4: fn_enrich_lead_from_omie
-- Score calculado APENAS aqui — nunca em TypeScript
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_enrich_lead_from_omie(p_lead_id uuid)
RETURNS void AS $$
DECLARE
  v_fat_total     numeric := 0;
  v_val_pago      numeric := 0;
  v_val_aberto    numeric := 0;
  v_val_vencido   numeric := 0;
  v_pct_pago      numeric := 0;
  v_ticket_medio  numeric := 0;
  v_freq_compra   integer := 0;
  v_ultima_compra date;
  v_dias_sem      integer;
  v_inadimplente  boolean := false;
  v_dias_atraso   integer := 0;
  v_score         integer := 0;
  v_total_pedidos integer := 0;
  v_ultima_nf     date;
  v_cancelamentos integer := 0;
  v_classificacao text;
BEGIN
  -- Faturamento e frequência (deal_items do Omie)
  SELECT
    COALESCE(SUM(total_value), 0),
    COUNT(DISTINCT nfe_number) FILTER (WHERE nfe_number IS NOT NULL),
    COUNT(DISTINCT COALESCE(nfe_number, id::text)),
    MAX(synced_at::date)
  INTO v_fat_total, v_freq_compra, v_total_pedidos, v_ultima_nf
  FROM deal_items
  WHERE lead_id = p_lead_id
    AND source IN ('omie','omie_nfe');

  -- Financeiro de parcelas (única fonte de verdade)
  SELECT
    COALESCE(SUM(CASE WHEN status='PAGO'
      THEN COALESCE(valor_pago, valor) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('PENDENTE','VENCIDO')
      THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status='VENCIDO'
      THEN valor ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN status='VENCIDO'
      THEN (CURRENT_DATE - data_vencimento) END), 0),
    COUNT(*) FILTER (WHERE status = 'CANCELADO')
  INTO v_val_pago, v_val_aberto, v_val_vencido, v_dias_atraso, v_cancelamentos
  FROM omie_parcelas
  WHERE lead_id = p_lead_id;

  -- Última compra (GREATEST com COALESCE para evitar NULL)
  SELECT GREATEST(
    COALESCE((SELECT MAX(synced_at::date)
     FROM deal_items WHERE lead_id = p_lead_id AND source LIKE 'omie%'), '1900-01-01'::date),
    COALESCE((SELECT MAX(data_vencimento)
     FROM omie_parcelas WHERE lead_id = p_lead_id AND status = 'PAGO'), '1900-01-01'::date)
  ) INTO v_ultima_compra;
  IF v_ultima_compra = '1900-01-01'::date THEN v_ultima_compra := NULL; END IF;

  -- Derivados
  v_inadimplente := v_val_vencido > 0;
  v_dias_sem     := CASE WHEN v_ultima_compra IS NOT NULL
                    THEN (CURRENT_DATE - v_ultima_compra) ELSE NULL END;
  -- % pago = pago / (pago + aberto) — não mistura NF com parcela
  v_pct_pago     := CASE WHEN (v_val_pago + v_val_aberto) > 0
                    THEN ROUND((v_val_pago / (v_val_pago + v_val_aberto)) * 100, 1) ELSE 0 END;
  v_ticket_medio := CASE WHEN v_freq_compra > 0
                    THEN ROUND(v_fat_total / v_freq_compra, 2) ELSE 0 END;

  -- Score ponderado 0–100
  v_score := GREATEST(0, LEAST(100,
      LEAST(30, (v_fat_total / 1000)::integer)
    + LEAST(20, v_freq_compra * 2)
    + LEAST(20, (v_ticket_medio / 500)::integer)
    + LEAST(10, (v_pct_pago / 10)::integer)
    + 10
    + GREATEST(-15, -((v_val_vencido / 500)::integer))
    + GREATEST(-10, -((v_dias_atraso / 10)::integer))
    + GREATEST(-5,  -(v_cancelamentos * 5))
  ));

  -- Classificação operacional
  v_classificacao := CASE
    WHEN v_inadimplente THEN 'RECUPERACAO'
    WHEN v_score >= 80 AND NOT v_inadimplente THEN 'PRIORIDADE'
    WHEN COALESCE(v_dias_sem, 999) > 180 THEN 'REATIVACAO'
    WHEN v_score >= 20 THEN 'ATIVO'
    ELSE 'MONITORAR'
  END;

  UPDATE lia_attendances SET
    omie_faturamento_total = v_fat_total,
    ltv_total              = v_fat_total,
    omie_valor_pago        = v_val_pago,
    omie_valor_em_aberto   = v_val_aberto,
    omie_valor_vencido     = v_val_vencido,
    omie_percentual_pago   = v_pct_pago,
    omie_ticket_medio      = v_ticket_medio,
    omie_frequencia_compra = v_freq_compra,
    omie_ultima_compra     = v_ultima_compra,
    omie_dias_sem_comprar  = v_dias_sem,
    omie_inadimplente      = v_inadimplente,
    omie_dias_atraso_max   = v_dias_atraso,
    omie_score             = v_score,
    omie_total_pedidos     = v_total_pedidos,
    omie_ultima_nf_emitida = v_ultima_nf,
    omie_classificacao     = v_classificacao,
    omie_last_sync         = now()
  WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- BLOCO 5: fn_map_omie_titulo_status + UNIQUE index + cursors
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_map_omie_titulo_status(s text)
RETURNS text AS $$
BEGIN
  RETURN CASE upper(trim(s))
    WHEN 'RECEBIDO'  THEN 'PAGO'
    WHEN 'LIQUIDADO' THEN 'PAGO'
    WHEN 'BAIXADO'   THEN 'PAGO'
    WHEN 'ATRASADO'  THEN 'VENCIDO'
    WHEN 'VENCIDO'   THEN 'VENCIDO'
    WHEN 'CANCELADO' THEN 'CANCELADO'
    ELSE 'PENDENTE'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Recrear index como UNIQUE para upsert via omie_titulo_id
DROP INDEX IF EXISTS idx_parcelas_titulo_id;
CREATE UNIQUE INDEX idx_omie_parcelas_titulo_id
  ON omie_parcelas(omie_titulo_id)
  WHERE omie_titulo_id IS NOT NULL;

-- Index para performance de consultas de inadimplência
CREATE INDEX IF NOT EXISTS idx_parcelas_vencido_por_lead
  ON omie_parcelas(lead_id)
  WHERE status = 'VENCIDO';

-- Tabela de cursors para idempotência do backfill
CREATE TABLE IF NOT EXISTS omie_sync_cursors (
  key   text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  meta  jsonb,
  updated_at timestamptz DEFAULT now()
);