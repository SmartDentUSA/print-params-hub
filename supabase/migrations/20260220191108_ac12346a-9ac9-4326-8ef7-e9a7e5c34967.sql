-- Índice único para suportar o upsert por title + source_label
-- COALESCE trata NULL como string vazia para que dois registros com source_label=NULL e mesmo title sejam detectados como conflito
CREATE UNIQUE INDEX IF NOT EXISTS company_kb_texts_title_source_label_idx
  ON public.company_kb_texts (title, COALESCE(source_label, ''));