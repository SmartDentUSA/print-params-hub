-- Atribuir autor padrão (Dr. Webber Ricci) a todos os artigos sem autor
UPDATE knowledge_contents 
SET author_id = 'a19ef0a8-6ca4-4dab-98ff-c7ab92da6f73',
    updated_at = now()
WHERE author_id IS NULL AND active = true;