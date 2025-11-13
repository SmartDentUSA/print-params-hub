-- Inserir Categoria F (Parâmetros Técnicos) com enabled=false (oculta na navegação)
INSERT INTO knowledge_categories (name, letter, order_index, enabled)
VALUES ('Parâmetros Técnicos', 'F', 6, false)
ON CONFLICT (letter) DO UPDATE SET
  name = EXCLUDED.name,
  order_index = EXCLUDED.order_index,
  enabled = false;