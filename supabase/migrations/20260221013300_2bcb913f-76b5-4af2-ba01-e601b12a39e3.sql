
-- 1. Remover CHECK antigo e adicionar com todas as categorias
ALTER TABLE company_kb_texts DROP CONSTRAINT IF EXISTS company_kb_texts_category_check;

ALTER TABLE company_kb_texts ADD CONSTRAINT company_kb_texts_category_check
  CHECK (category = ANY (ARRAY[
    'sdr', 'comercial', 'workflow', 'suporte', 'faq',
    'objecoes', 'onboarding', 'geral',
    'leads', 'clientes', 'campanhas', 'pos_venda'
  ]));

-- 2. Adicionar constraint UNIQUE para o upsert funcionar
ALTER TABLE company_kb_texts
  ADD CONSTRAINT company_kb_texts_title_source_label_key
  UNIQUE (title, source_label);
