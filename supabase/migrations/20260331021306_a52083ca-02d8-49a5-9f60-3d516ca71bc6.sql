-- deal_items extensions
ALTER TABLE deal_items
  ADD COLUMN IF NOT EXISTS source        text DEFAULT 'piperun',
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS nfe_number    text,
  ADD COLUMN IF NOT EXISTS nfe_chave     char(44);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_deal_item_nfe') THEN
    ALTER TABLE deal_items ADD CONSTRAINT uq_deal_item_nfe UNIQUE (lead_id, nfe_number, product_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deal_items_nfe_chave ON deal_items(nfe_chave) WHERE nfe_chave IS NOT NULL;

-- deal_status_history
CREATE TABLE IF NOT EXISTS deal_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lia_attendances(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('crm','erp')),
  status text NOT NULL,
  event_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dsh_lead_id ON deal_status_history(lead_id, created_at DESC);

-- omie_parcelas
CREATE TABLE IF NOT EXISTS omie_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES lia_attendances(id) ON DELETE CASCADE,
  omie_pedido_id bigint, omie_titulo_id bigint, omie_titulo_repet bigint,
  nfe_chave char(44), numero_pedido text,
  numero_parcela integer NOT NULL DEFAULT 1, total_parcelas integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0, valor_pago numeric DEFAULT 0,
  data_vencimento date NOT NULL, data_pagamento date,
  tipo_documento text DEFAULT 'BOL', status text NOT NULL DEFAULT 'PENDENTE',
  cobranca_enviada_em timestamptz, cobranca_canal text, cobranca_count integer DEFAULT 0,
  source text DEFAULT 'omie', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

ALTER TABLE omie_parcelas DROP CONSTRAINT IF EXISTS chk_parcela_status;
ALTER TABLE omie_parcelas ADD CONSTRAINT chk_parcela_status CHECK (
  status IN ('PENDENTE','PAGO','VENCIDO','CANCELADO','PARCIALMENTE_PAGO')
);

CREATE INDEX IF NOT EXISTS idx_parcelas_lead_id ON omie_parcelas(lead_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencidas ON omie_parcelas(data_vencimento, status) WHERE status IN ('PENDENTE','VENCIDO');
CREATE INDEX IF NOT EXISTS idx_parcelas_titulo_id ON omie_parcelas(omie_titulo_id) WHERE omie_titulo_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_parcela_pedido') THEN
    ALTER TABLE omie_parcelas ADD CONSTRAINT uq_parcela_pedido UNIQUE (omie_pedido_id, numero_parcela);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_parcelas_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcelas_updated_at ON omie_parcelas;
CREATE TRIGGER trg_parcelas_updated_at BEFORE UPDATE ON omie_parcelas
  FOR EACH ROW EXECUTE FUNCTION fn_parcelas_updated_at();

CREATE OR REPLACE FUNCTION fn_atualizar_parcelas_vencidas() RETURNS integer AS $$
DECLARE cnt integer;
BEGIN
  UPDATE omie_parcelas SET status = 'VENCIDO' WHERE status = 'PENDENTE' AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS cnt = ROW_COUNT; RETURN cnt;
END;
$$ LANGUAGE plpgsql;

-- View
CREATE OR REPLACE VIEW v_lead_financeiro AS
SELECT lead_id,
  COUNT(*) AS total_parcelas,
  SUM(valor) AS valor_total,
  SUM(CASE WHEN status='PAGO' THEN COALESCE(valor_pago,valor) ELSE 0 END) AS valor_pago,
  SUM(CASE WHEN status IN ('PENDENTE','VENCIDO') THEN valor ELSE 0 END) AS valor_pendente,
  SUM(CASE WHEN status='VENCIDO' THEN valor ELSE 0 END) AS valor_vencido,
  COUNT(CASE WHEN status='PAGO' THEN 1 END) AS parcelas_pagas,
  COUNT(CASE WHEN status='VENCIDO' THEN 1 END) AS parcelas_vencidas,
  COUNT(CASE WHEN status='PENDENTE' THEN 1 END) AS parcelas_pendentes,
  COUNT(CASE WHEN status='CANCELADO' THEN 1 END) AS parcelas_canceladas,
  MIN(CASE WHEN status IN ('PENDENTE','VENCIDO') THEN data_vencimento END) AS proximo_vencimento,
  MAX(CASE WHEN status='VENCIDO' THEN (CURRENT_DATE - data_vencimento) END) AS max_dias_vencido,
  CASE WHEN COUNT(*)=0 THEN NULL ELSE ROUND(100.0*COUNT(CASE WHEN status='PAGO' THEN 1 END)::numeric/COUNT(*),1) END AS percentual_pago,
  MAX(updated_at) AS ultima_atualizacao
FROM omie_parcelas GROUP BY lead_id;