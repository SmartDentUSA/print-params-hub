-- Adicionar colunas para 3 CTAs customizáveis na tabela resins
ALTER TABLE resins 
ADD COLUMN cta_1_label TEXT,
ADD COLUMN cta_1_url TEXT,
ADD COLUMN cta_2_label TEXT,
ADD COLUMN cta_2_url TEXT,
ADD COLUMN cta_3_label TEXT,
ADD COLUMN cta_3_url TEXT;