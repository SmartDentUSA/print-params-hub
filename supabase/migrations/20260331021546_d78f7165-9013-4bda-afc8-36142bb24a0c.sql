-- Campos Omie em lia_attendances
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS omie_codigo_cliente bigint,
  ADD COLUMN IF NOT EXISTS omie_last_sync      timestamptz,
  ADD COLUMN IF NOT EXISTS omie_nf_count       integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_omie_cliente
  ON lia_attendances(omie_codigo_cliente) WHERE omie_codigo_cliente IS NOT NULL;

-- ERP status
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS erp_status      text DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS erp_last_event  text,
  ADD COLUMN IF NOT EXISTS erp_updated_at  timestamptz;

ALTER TABLE lia_attendances DROP CONSTRAINT IF EXISTS chk_erp_status;
ALTER TABLE lia_attendances ADD CONSTRAINT chk_erp_status CHECK (
  erp_status IN ('NONE','ORCADO','FATURADO','CANCELADO','PARCIALMENTE_PAGO','PAGO','INADIMPLENTE','DEVOLVIDO')
);

CREATE INDEX IF NOT EXISTS idx_lia_erp_status ON lia_attendances(erp_status) WHERE erp_status != 'NONE';

-- Frete
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS frete_status           text DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS frete_transportadora   text,
  ADD COLUMN IF NOT EXISTS frete_codigo_rastreio  text,
  ADD COLUMN IF NOT EXISTS frete_link_rastreio    text,
  ADD COLUMN IF NOT EXISTS frete_valor            numeric,
  ADD COLUMN IF NOT EXISTS frete_tipo             text,
  ADD COLUMN IF NOT EXISTS frete_previsao_entrega date,
  ADD COLUMN IF NOT EXISTS frete_updated_at       timestamptz;

ALTER TABLE lia_attendances DROP CONSTRAINT IF EXISTS chk_frete_status;
ALTER TABLE lia_attendances ADD CONSTRAINT chk_frete_status CHECK (
  frete_status IN ('NONE','AGUARDANDO_DESPACHO','DESPACHADO','EM_TRANSITO','ENTREGUE','DEVOLVIDO','EXTRAVIADO')
);

CREATE INDEX IF NOT EXISTS idx_lia_frete_status ON lia_attendances(frete_status) WHERE frete_status != 'NONE';

-- real_status (GENERATED)
ALTER TABLE lia_attendances DROP COLUMN IF EXISTS real_status;
ALTER TABLE lia_attendances ADD COLUMN real_status text GENERATED ALWAYS AS (
  CASE
    WHEN frete_status IN ('DEVOLVIDO','EXTRAVIADO') THEN 'DEAL_PERDIDO'
    WHEN erp_status IN ('CANCELADO','DEVOLVIDO') THEN 'DEAL_PERDIDO'
    WHEN erp_status = 'INADIMPLENTE' THEN 'INADIMPLENTE'
    WHEN erp_status = 'PAGO' AND frete_status IN ('ENTREGUE','NONE') THEN 'CLIENTE_ATIVO'
    WHEN erp_status = 'PAGO' AND frete_status NOT IN ('ENTREGUE','NONE') THEN 'AGUARDANDO_ENTREGA'
    WHEN frete_status = 'EM_TRANSITO' THEN 'EM_TRANSITO'
    WHEN erp_status IN ('FATURADO','PARCIALMENTE_PAGO') THEN 'AGUARDANDO_PAGAMENTO'
    WHEN status_oportunidade = 'ganha' AND (erp_status IS NULL OR erp_status = 'NONE') THEN 'RISCO_OPERACIONAL'
    WHEN status_oportunidade = 'perdida' THEN 'NEGOCIO_PERDIDO'
    ELSE 'EM_NEGOCIACAO'
  END
) STORED;