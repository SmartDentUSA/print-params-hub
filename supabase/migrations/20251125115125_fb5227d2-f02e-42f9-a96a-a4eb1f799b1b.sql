-- Atualizar nomes das categorias D e E
UPDATE knowledge_categories 
SET name = 'Casos Clínicos', updated_at = now() 
WHERE letter = 'D';

UPDATE knowledge_categories 
SET name = 'Ebooks e Guias', updated_at = now() 
WHERE letter = 'E';