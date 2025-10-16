-- Adicionar coluna description
ALTER TABLE public.resins 
ADD COLUMN description text;

-- Adicionar coluna price
ALTER TABLE public.resins 
ADD COLUMN price numeric(10,2);

-- Comentários
COMMENT ON COLUMN public.resins.description IS 
  'Descrição detalhada do produto/resina importada da Loja Integrada';

COMMENT ON COLUMN public.resins.price IS 
  'Preço do produto para SEO (Schema.org Offers)';