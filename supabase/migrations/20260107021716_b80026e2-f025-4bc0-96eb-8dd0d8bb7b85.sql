-- Adicionar campo veredict_data para Featured Snippets AI-First
ALTER TABLE public.knowledge_contents 
ADD COLUMN IF NOT EXISTS veredict_data JSONB DEFAULT NULL;

-- Comentário explicativo do campo
COMMENT ON COLUMN public.knowledge_contents.veredict_data IS 'Dados estruturados para VeredictBox (Featured Snippet). Formato: {productName, veredict, summary, quickFacts[], testNorms[]}';