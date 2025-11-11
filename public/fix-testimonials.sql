-- ====================================================================
-- CORREÇÃO DE ESTRUTURA: DEPOIMENTOS SYSTEM_A_CATALOG
-- ====================================================================
-- Este script deleta o registro "liente-2" problemático e cria
-- registros individuais para cada depoimento com estrutura correta
-- ====================================================================

BEGIN;

-- 1. DELETAR O REGISTRO PROBLEMÁTICO
DELETE FROM system_a_catalog 
WHERE id = 'a8613352-916b-479d-87cc-03c52ded0833';

-- 2. CRIAR REGISTROS INDIVIDUAIS PARA CADA DEPOIMENTO

-- Depoimento 1: Dr. Guilherme - Jaguaré/ES
INSERT INTO system_a_catalog (
  external_id,
  source,
  category,
  name,
  slug,
  description,
  extra_data,
  seo_title_override,
  meta_description,
  og_image_url,
  keywords,
  approved,
  active,
  visible_in_ui,
  display_order
) VALUES (
  'depoimento-dr-guilherme-jaguare',
  'system_a',
  'testimonials',
  'Dr. Guilherme - Fluxo Digital em Jaguaré/ES',
  'dr-guilherme-jaguare-fluxo-digital',
  'O Dr. Guilherme, cirurgião-dentista de Jaguaré/ES, compartilha como implementou o fluxo digital completo em sua clínica utilizando impressoras 3D e resinas Smartdent. Veja os resultados práticos e a transformação no atendimento aos pacientes.',
  jsonb_build_object(
    'location', 'Jaguaré/ES',
    'specialty', 'Cirurgião-Dentista',
    'profession', 'Dentista',
    'youtube_url', 'https://www.youtube.com/shorts/[INSIRA_VIDEO_ID_AQUI]',
    'instagram_url', 'https://www.instagram.com/reel/[INSIRA_REEL_ID_AQUI]/',
    'video_duration', '60',
    'highlights', ARRAY['Fluxo Digital', 'Impressão 3D', 'Resultados Práticos']
  ),
  'Dr. Guilherme Transforma Prática Odontológica com Fluxo Digital | Smartdent',
  'Veja como o Dr. Guilherme, de Jaguaré/ES, revolucionou sua clínica com impressão 3D e fluxo digital. Resultados reais com resinas Smartdent.',
  'https://img.youtube.com/vi/[VIDEO_ID]/maxresdefault.jpg',
  ARRAY['fluxo digital odontologia', 'impressão 3D dental', 'Dr. Guilherme Jaguaré', 'dentista digital ES', 'smartdent depoimento'],
  true,
  true,
  true,
  1
);

-- Depoimento 2: Dra. Joyce - São Paulo (30 anos de experiência)
INSERT INTO system_a_catalog (
  external_id,
  source,
  category,
  name,
  slug,
  description,
  extra_data,
  seo_title_override,
  meta_description,
  og_image_url,
  keywords,
  approved,
  active,
  visible_in_ui,
  display_order
) VALUES (
  'depoimento-dra-joyce-sao-paulo',
  'system_a',
  'testimonials',
  'Dra. Joyce - 30 Anos de Experiência em São Paulo',
  'dra-joyce-sao-paulo-30-anos-experiencia',
  'Com 30 anos de experiência, a Dra. Joyce de São Paulo compartilha sua jornada na odontologia moderna e como a tecnologia de impressão 3D transformou sua prática clínica. Um relato inspirador sobre inovação e tradição.',
  jsonb_build_object(
    'location', 'São Paulo/SP',
    'specialty', 'Cirurgiã-Dentista',
    'profession', 'Dentista',
    'experience_years', '30',
    'youtube_url', 'https://www.youtube.com/shorts/[INSIRA_VIDEO_ID_AQUI]',
    'instagram_url', 'https://www.instagram.com/reel/[INSIRA_REEL_ID_AQUI]/',
    'video_duration', '60',
    'highlights', ARRAY['30 Anos de Experiência', 'Tecnologia 3D', 'São Paulo']
  ),
  'Dra. Joyce: 30 Anos de Odontologia e Inovação Digital | Smartdent',
  'Dra. Joyce, com 30 anos de experiência em São Paulo, revela como a impressão 3D elevou sua prática odontológica a um novo patamar.',
  'https://img.youtube.com/vi/[VIDEO_ID]/maxresdefault.jpg',
  ARRAY['dentista experiente são paulo', 'Dra Joyce odontologia', '30 anos odontologia', 'impressão 3D dental SP', 'smartdent são paulo'],
  true,
  true,
  true,
  2
);

-- Depoimento 3: Dra. Paloma - Bahia (Implantodontista)
INSERT INTO system_a_catalog (
  external_id,
  source,
  category,
  name,
  slug,
  description,
  extra_data,
  seo_title_override,
  meta_description,
  og_image_url,
  keywords,
  approved,
  active,
  visible_in_ui,
  display_order
) VALUES (
  'depoimento-dra-paloma-bahia-implantodontista',
  'system_a',
  'testimonials',
  'Dra. Paloma - Implantodontista na Bahia',
  'dra-paloma-bahia-implantodontista',
  'A Dra. Paloma, implantodontista atuante na Bahia, apresenta como utiliza a impressão 3D em procedimentos de implantodontia, proporcionando maior precisão e conforto aos pacientes. Conheça sua experiência com guias cirúrgicos e próteses.',
  jsonb_build_object(
    'location', 'Bahia/BA',
    'specialty', 'Implantodontista',
    'profession', 'Dentista',
    'youtube_url', 'https://www.youtube.com/shorts/[INSIRA_VIDEO_ID_AQUI]',
    'instagram_url', 'https://www.instagram.com/reel/[INSIRA_REEL_ID_AQUI]/',
    'video_duration', '60',
    'highlights', ARRAY['Implantodontia', 'Guias Cirúrgicos', 'Precisão 3D']
  ),
  'Dra. Paloma: Implantodontia de Precisão com Impressão 3D | Smartdent',
  'Implantodontista Dra. Paloma da Bahia mostra como a impressão 3D revolucionou seus procedimentos com guias cirúrgicos precisos.',
  'https://img.youtube.com/vi/[VIDEO_ID]/maxresdefault.jpg',
  ARRAY['implantodontista bahia', 'Dra Paloma implantes', 'guia cirúrgico 3D', 'implantodontia digital', 'smartdent bahia'],
  true,
  true,
  true,
  3
);

-- Depoimento 4: Template para adicionar mais depoimentos
-- COPIE E ADAPTE este template para cada novo depoimento encontrado no texto original

/*
INSERT INTO system_a_catalog (
  external_id,
  source,
  category,
  name,
  slug,
  description,
  extra_data,
  seo_title_override,
  meta_description,
  og_image_url,
  keywords,
  approved,
  active,
  visible_in_ui,
  display_order
) VALUES (
  'depoimento-[SLUG-DO-DENTISTA]',
  'system_a',
  'testimonials',
  '[Nome Completo - Localização]',
  '[slug-seo-friendly]',
  '[Descrição detalhada do depoimento com contexto sobre o dentista e sua experiência]',
  jsonb_build_object(
    'location', '[Cidade/Estado]',
    'specialty', '[Especialidade]',
    'profession', 'Dentista',
    'youtube_url', 'https://www.youtube.com/shorts/[VIDEO_ID]',
    'instagram_url', 'https://www.instagram.com/reel/[REEL_ID]/',
    'video_duration', '[segundos]',
    'highlights', ARRAY['[Destaque 1]', '[Destaque 2]', '[Destaque 3]']
  ),
  '[Título SEO com keyword principal e marca]',
  '[Meta description de 150-160 caracteres com call-to-action]',
  'https://img.youtube.com/vi/[VIDEO_ID]/maxresdefault.jpg',
  ARRAY['[keyword 1]', '[keyword 2]', '[keyword 3]', '[keyword 4]', '[keyword 5]'],
  true,
  true,
  true,
  [NÚMERO_ORDEM]
);
*/

COMMIT;

-- ====================================================================
-- PRÓXIMOS PASSOS APÓS EXECUTAR ESTE SQL:
-- ====================================================================
-- 1. Substituir [INSIRA_VIDEO_ID_AQUI] e [INSIRA_REEL_ID_AQUI] pelas URLs reais
--    extraídas do texto original do registro "liente-2"
--
-- 2. Verificar se existem mais depoimentos no texto original e usar o
--    template acima para criar registros adicionais
--
-- 3. Atualizar og_image_url com os thumbnails corretos dos vídeos
--
-- 4. Executar o SQL no Supabase SQL Editor:
--    https://supabase.com/dashboard/project/okeogjgqijbfkudfjadz/sql/new
--
-- 5. Testar as páginas:
--    - /depoimentos/dr-guilherme-jaguare-fluxo-digital
--    - /depoimentos/dra-joyce-sao-paulo-30-anos-experiencia
--    - /depoimentos/dra-paloma-bahia-implantodontista
--
-- 6. Verificar Schema.org com Google Rich Results Test:
--    https://search.google.com/test/rich-results
-- ====================================================================
