-- Remover a constraint CHECK que limita as letras
ALTER TABLE knowledge_categories 
  DROP CONSTRAINT IF EXISTS knowledge_categories_letter_check;

-- Adicionar uma nova constraint mais flexível (permite letras de A-Z)
ALTER TABLE knowledge_categories 
  ADD CONSTRAINT knowledge_categories_letter_check 
  CHECK (letter ~ '^[A-Z]$');

-- Inserir a nova categoria E -> Informativos
INSERT INTO knowledge_categories (name, letter, order_index, enabled) 
VALUES ('Informativos', 'E', 5, true)
ON CONFLICT DO NOTHING;