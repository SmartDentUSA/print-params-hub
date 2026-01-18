-- Atualizar artigo com author_id e keywords para E-E-A-T
UPDATE knowledge_contents 
SET 
  author_id = 'a19ef0a8-6ca4-4dab-98ff-c7ab92da6f73',
  keywords = ARRAY['lesões cervicais', 'LCNC', 'restauração classe V', 'resina composta', 'abrasão dental', 'desgaste dental', 'adesão dentina', 'protocolo restaurador', 'odontologia restauradora', 'estética dental', 'lesões cervicais não cariosas', 'abfração']
WHERE id = 'db26a55a-81a8-4f43-9e94-fa3a5c45c3d5';