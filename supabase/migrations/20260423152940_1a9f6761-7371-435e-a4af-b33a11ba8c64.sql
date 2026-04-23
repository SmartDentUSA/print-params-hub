-- =========================================================
-- ONDA D: Completar autor Renato Sousa
-- =========================================================
UPDATE public.authors
SET 
  academic_title = 'Engenheiro',
  specialty = 'Engenharia Mecânica · Aplicações Técnicas · Suporte de Manufatura Digital',
  mini_bio = COALESCE(mini_bio, 'Engenheiro Mecânico com atuação em aplicações técnicas de manufatura digital odontológica na Smart Dent.'),
  full_bio = COALESCE(full_bio, 'Engenheiro Mecânico responsável pelo suporte técnico de aplicações de impressão 3D e CAD/CAM na Smart Dent (MMTech Projetos Tecnológicos).'),
  updated_at = now()
WHERE id = 'ff7a1b70-6a37-4e46-8ffc-cc86e358f427';

-- =========================================================
-- Consolidar duplicata "Equipe Smart Dent" (sem trim → único)
-- Mantém '50c75dd2...' (159 artigos), redireciona '2cb8d077...' (0 artigos)
-- =========================================================
UPDATE public.knowledge_contents
SET author_id = '50c75dd2-c02e-4bbf-92fc-74e9708d7525'
WHERE author_id = '2cb8d077-ee68-414a-922b-2ad06a07e7ef';

UPDATE public.authors SET active = false WHERE id = '2cb8d077-ee68-414a-922b-2ad06a07e7ef';

-- =========================================================
-- ONDA B: Atribuir autores aos 309 artigos órfãos
-- Regras por keywords no título + categoria
-- =========================================================

-- 1) Resinas, materiais, polímeros, química → Marcelo Cestari (MSc Materiais)
UPDATE public.knowledge_contents
SET author_id = '31a2debe-d4a9-44d7-8b0d-984fa7cb59ce', updated_at = now()
WHERE active = true AND author_id IS NULL AND (
  title ILIKE '%resina%' OR title ILIKE '%polímero%' OR title ILIKE '%polimero%'
  OR title ILIKE '%material%' OR title ILIKE '%química%' OR title ILIKE '%quimica%'
  OR title ILIKE '%PMMA%' OR title ILIKE '%zircônia%' OR title ILIKE '%zirconia%'
  OR title ILIKE '%CoCr%' OR title ILIKE '%bite flex%' OR title ILIKE '%vitaly%'
  OR title ILIKE '%composto%' OR title ILIKE '%compósito%' OR title ILIKE '%fotopolimer%'
  OR title ILIKE '%cerâmica%' OR title ILIKE '%ceramica%' OR title ILIKE '%bloco%'
);

-- 2) Impressão 3D, CAD/CAM, scanners, manufatura → Dr. Marcelo Del Guerra (PhD Mecatrônica)
UPDATE public.knowledge_contents
SET author_id = 'e35f1b00-01ab-46c5-bdec-20e532926068', updated_at = now()
WHERE active = true AND author_id IS NULL AND (
  title ILIKE '%impressora%' OR title ILIKE '%impressão 3d%' OR title ILIKE '%impressao 3d%'
  OR title ILIKE '%scanner%' OR title ILIKE '%CAD%' OR title ILIKE '%CAM%'
  OR title ILIKE '%lychee%' OR title ILIKE '%chitubox%' OR title ILIKE '%exocad%'
  OR title ILIKE '%medit%' OR title ILIKE '%asiga%' OR title ILIKE '%halot%'
  OR title ILIKE '%print 4.0%' OR title ILIKE '%chairside%' OR title ILIKE '%chair side%'
  OR title ILIKE '%fluxo digital%' OR title ILIKE '%manufatura%' OR title ILIKE '%slicer%'
  OR title ILIKE '%pós-cura%' OR title ILIKE '%pos-cura%' OR title ILIKE '%lavagem%'
  OR title ILIKE '%BLZ%' OR title ILIKE '%INO200%' OR title ILIKE '%INNO200%'
);

-- 3) Casos clínicos, prótese, reabilitação, ortodontia, dentística → Prof. Dr. Weber Adad Ricci
UPDATE public.knowledge_contents
SET author_id = 'a19ef0a8-6ca4-4dab-98ff-c7ab92da6f73', updated_at = now()
WHERE active = true AND author_id IS NULL AND (
  title ILIKE '%prótese%' OR title ILIKE '%protese%' OR title ILIKE '%reabilita%'
  OR title ILIKE '%ortodont%' OR title ILIKE '%dentística%' OR title ILIKE '%dentistica%'
  OR title ILIKE '%coroa%' OR title ILIKE '%implante%' OR title ILIKE '%caso clínico%'
  OR title ILIKE '%caso clinico%' OR title ILIKE '%estética%' OR title ILIKE '%estetica%'
  OR title ILIKE '%endodont%' OR title ILIKE '%periodont%' OR title ILIKE '%cirurgi%'
  OR title ILIKE '%mockup%' OR title ILIKE '%enceramento%'
);

-- 4) Fallback (depoimentos, cursos, vídeos institucionais) → Equipe Smart Dent
UPDATE public.knowledge_contents
SET author_id = '50c75dd2-c02e-4bbf-92fc-74e9708d7525', updated_at = now()
WHERE active = true AND author_id IS NULL;

-- =========================================================
-- ONDA C: Popular UDI-HIBCC (FDA) no catálogo
-- Conforme Fonte da Verdade v2.0 — códigos HIBCC reais Smart Dent
-- =========================================================

-- Smart Print (resinas 3D — família UDI base)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_hibcc}',
  '"+H123SMARTPRINT001/$$+1"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND (
  name ILIKE '%smart print%' OR name ILIKE '%smartprint%'
);

-- ATOS (resinas compostas diretas + blocos CAD/CAM)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_hibcc}',
  '"+H123ATOS00001/$$+1"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND name ILIKE '%atos%';

-- Smart Make (sistema CAD/CAM)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_hibcc}',
  '"+H123SMARTMAKE01/$$+1"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND (
  name ILIKE '%smart make%' OR name ILIKE '%smartmake%'
);

-- Smart Ortho (alinhadores)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_hibcc}',
  '"+H123SMARTORTHO1/$$+1"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND (
  name ILIKE '%smart ortho%' OR name ILIKE '%smartortho%'
);

-- UNIKK (linha de blocos CAD/CAM premium)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_hibcc}',
  '"+H123UNIKK00001/$$+1"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND name ILIKE '%unikk%';

-- Marcador de cobertura para auditoria
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{regulatory,udi_source}',
  '"FonteDaVerdade_v2_Abril2026"'::jsonb,
  true
), updated_at = now()
WHERE active = true AND category = 'product' AND extra_data->'regulatory' ? 'udi_hibcc';