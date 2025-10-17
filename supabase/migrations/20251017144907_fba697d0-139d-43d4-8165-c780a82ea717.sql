-- Adicionar campo FAQs na tabela knowledge_contents
ALTER TABLE knowledge_contents 
ADD COLUMN faqs JSONB DEFAULT NULL;

COMMENT ON COLUMN knowledge_contents.faqs IS 
'Array de FAQs no formato: [{"question": "...", "answer": "..."}]';
