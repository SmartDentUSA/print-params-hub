-- Correção completa de slugs, remoção de duplicatas e preenchimento de keywords
-- Parte 1: Regenerar slugs corretamente usando a ordem correta de operações

-- Primeiro, criar uma função auxiliar para normalização de texto (similar ao JavaScript normalize + remove accents)
CREATE OR REPLACE FUNCTION public.normalize_text(text_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(
    -- Remove acentos usando unaccent ou transliteração manual
    TRANSLATE(
      text_input,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )
  );
END;
$$;

-- Atualizar slugs usando a ordem correta: normalizar → substituir espaços → limpar
UPDATE system_a_catalog
SET slug = REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        public.normalize_text(name),  -- 1. Normalizar e lowercase
        '\s+', '-', 'g'               -- 2. Espaços → hífens
      ),
      '[^a-z0-9-]', '', 'g'           -- 3. Remover caracteres especiais
    ),
    '-+', '-', 'g'                    -- 4. Limpar hífens duplicados
  ),
  '^-|-$', '', 'g'                    -- 5. Remover hífens nas pontas
)
WHERE category = 'product' AND slug IS NOT NULL;

-- Parte 2: Remover duplicatas mantendo apenas o registro mais recente
DELETE FROM system_a_catalog a
USING system_a_catalog b
WHERE a.name = b.name 
  AND a.category = 'product'
  AND b.category = 'product'
  AND a.id != b.id  -- Diferentes registros
  AND a.created_at < b.created_at;  -- Deletar o mais antigo

-- Parte 3: Preencher keywords vazios
UPDATE system_a_catalog
SET keywords = ARRAY[
  'resina 3d',
  'impressão 3d odontológica',
  LOWER(SPLIT_PART(name, ' ', 1)),
  LOWER(SPLIT_PART(name, ' ', 2)),
  LOWER(SPLIT_PART(name, ' ', 3))
]
WHERE category = 'product'
  AND (keywords IS NULL OR keywords = '{}' OR ARRAY_LENGTH(keywords, 1) IS NULL);

-- Limpar função auxiliar (opcional, pode manter para uso futuro)
-- DROP FUNCTION IF EXISTS public.normalize_text(text);