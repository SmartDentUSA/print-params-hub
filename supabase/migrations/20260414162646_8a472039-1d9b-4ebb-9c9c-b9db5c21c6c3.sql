INSERT INTO knowledge_categories (letter, name, enabled, order_index)
VALUES ('G', 'Catálogo de Produtos', true, 7)
ON CONFLICT (letter) DO NOTHING;