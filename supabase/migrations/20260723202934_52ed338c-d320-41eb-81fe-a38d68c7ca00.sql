
-- =========================================================
-- 1) Clientes staging
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loja_integrada_clientes_import (
  id BIGINT PRIMARY KEY,
  email TEXT,
  nome TEXT,
  grupo TEXT,
  ativo TEXT,
  tipo TEXT,
  cpf TEXT,
  cnpj TEXT,
  razao_social TEXT,
  telefone_principal TEXT,
  telefone_comercial TEXT,
  telefone_celular TEXT,
  endereco JSONB,
  situacao TEXT,
  created_at_source TIMESTAMPTZ NOT NULL,
  raw JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loja_integrada_clientes_import TO authenticated;
GRANT ALL ON public.loja_integrada_clientes_import TO service_role;

ALTER TABLE public.loja_integrada_clientes_import ENABLE ROW LEVEL SECURITY;

CREATE POLICY "li_clientes_import_admin_read"
  ON public.loja_integrada_clientes_import
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_li_cli_import_email ON public.loja_integrada_clientes_import (lower(email));
CREATE INDEX IF NOT EXISTS idx_li_cli_import_cpf ON public.loja_integrada_clientes_import (cpf);
CREATE INDEX IF NOT EXISTS idx_li_cli_import_cnpj ON public.loja_integrada_clientes_import (cnpj);
CREATE INDEX IF NOT EXISTS idx_li_cli_import_tel_cel ON public.loja_integrada_clientes_import (telefone_celular);
CREATE INDEX IF NOT EXISTS idx_li_cli_import_tel_prin ON public.loja_integrada_clientes_import (telefone_principal);
CREATE INDEX IF NOT EXISTS idx_li_cli_import_created ON public.loja_integrada_clientes_import (created_at_source);

-- =========================================================
-- 2) Pedidos (item-a-item) staging
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loja_integrada_pedidos_items_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT,
  pedido_numero BIGINT NOT NULL,
  sku_produto TEXT,
  nome_produto TEXT,
  quantidade NUMERIC,
  pedido_situacao TEXT,
  pagamento_nome TEXT,
  envio_nome TEXT,
  pedido_valor_subtotal NUMERIC,
  pedido_valor_envio NUMERIC,
  pedido_valor_desconto NUMERIC,
  pedido_valor_total NUMERIC,
  order_created_at TIMESTAMPTZ NOT NULL,
  end_entrega JSONB,
  end_pagamento JSONB,
  observacao TEXT,
  raw JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loja_integrada_pedidos_items_import TO authenticated;
GRANT ALL ON public.loja_integrada_pedidos_items_import TO service_role;

ALTER TABLE public.loja_integrada_pedidos_items_import ENABLE ROW LEVEL SECURITY;

CREATE POLICY "li_pedidos_items_import_admin_read"
  ON public.loja_integrada_pedidos_items_import
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_li_ped_import_cliente ON public.loja_integrada_pedidos_items_import (cliente_id);
CREATE INDEX IF NOT EXISTS idx_li_ped_import_pedido ON public.loja_integrada_pedidos_items_import (pedido_numero);
CREATE INDEX IF NOT EXISTS idx_li_ped_import_sku ON public.loja_integrada_pedidos_items_import (sku_produto);
CREATE INDEX IF NOT EXISTS idx_li_ped_import_situacao ON public.loja_integrada_pedidos_items_import (pedido_situacao);
CREATE INDEX IF NOT EXISTS idx_li_ped_import_created ON public.loja_integrada_pedidos_items_import (order_created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_li_ped_import_natural
  ON public.loja_integrada_pedidos_items_import (pedido_numero, COALESCE(sku_produto,''), COALESCE(cliente_id,0));

-- =========================================================
-- 3) Coluna de amarração no lead
-- =========================================================
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS loja_integrada_customer_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_lia_att_li_customer
  ON public.lia_attendances (loja_integrada_customer_id)
  WHERE loja_integrada_customer_id IS NOT NULL;

-- =========================================================
-- 4) Função de identity resolution (email > cpf > cnpj > telefone)
-- =========================================================
CREATE OR REPLACE FUNCTION public.match_li_customer_to_lead(_li_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead UUID;
  v_email TEXT;
  v_cpf TEXT;
  v_cnpj TEXT;
  v_tel_cel TEXT;
  v_tel_prin TEXT;
BEGIN
  SELECT lower(nullif(email,'')),
         nullif(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(cnpj,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(telefone_celular,''),'[^0-9]','','g'),''),
         nullif(regexp_replace(coalesce(telefone_principal,''),'[^0-9]','','g'),'')
    INTO v_email, v_cpf, v_cnpj, v_tel_cel, v_tel_prin
  FROM public.loja_integrada_clientes_import
  WHERE id = _li_id;

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_lead
    FROM public.lia_attendances
    WHERE merged_into IS NULL AND lower(email) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_cpf IS NOT NULL THEN
    SELECT id INTO v_lead
    FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(pessoa_cpf,''),'[^0-9]','','g') = v_cpf
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_cnpj IS NOT NULL THEN
    SELECT id INTO v_lead
    FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(empresa_cnpj,''),'[^0-9]','','g') = v_cnpj
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_tel_cel IS NOT NULL THEN
    SELECT id INTO v_lead
    FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(telefone,''),'[^0-9]','','g') = v_tel_cel
    ORDER BY created_at ASC
    LIMIT 1;
    IF v_lead IS NOT NULL THEN RETURN v_lead; END IF;
  END IF;

  IF v_tel_prin IS NOT NULL THEN
    SELECT id INTO v_lead
    FROM public.lia_attendances
    WHERE merged_into IS NULL
      AND regexp_replace(coalesce(telefone,''),'[^0-9]','','g') = v_tel_prin
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_lead;
END;
$$;

REVOKE ALL ON FUNCTION public.match_li_customer_to_lead(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_li_customer_to_lead(BIGINT) TO authenticated, service_role;
