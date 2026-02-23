
-- Parte 1: Adicionar entrada de videos do playbook ao Brain Feeder
INSERT INTO public.company_kb_texts (title, category, source_label, content, active)
VALUES (
  'Edge Mini — Vídeos e Demonstrações',
  'comercial',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Vídeos e Demonstrações

Vídeos oficiais de demonstração e apresentação da impressora 3D Rayshape Edge Mini para odontologia:

1. Vídeo Institucional Edge Mini — O Futuro do Atendimento em Consultório
   Apresenta a interface intuitiva, nivelamento automático, plataformas intercambiáveis, resolução de 35 µm e impressão de próteses híbridas em 20 minutos.
   YouTube: https://www.youtube.com/watch?v=Zek71F0Zt8Y

2. O Maior Desafio do Dentista Digital na Impressão 3D
   Shorts que aborda as dores do dentista digital (insegurança, desperdício) e como a Edge Mini resolve com nivelamento automático, ShapeWare 2.0 com IA, coroa em 17 min, faceta em 12 min.
   YouTube: https://www.youtube.com/shorts/tmEftJ89Sng

3. Smart Dent + RayShape Apresentam a EDGE MINI
   Shorts com specs: nivelamento automático, duas plataformas (130×80×100 mm e MiniVat 74×64×100 mm), aquecimento integrado, precisão 34,4 µm, ShapeWare 2.0 com IA.
   YouTube: https://www.youtube.com/shorts/LmKWCbLj9vQ

4. Fluxo Digital SmartDent — Escanear, Enviar, Imprimir, Instalar
   Shorts mostrando o fluxo digital completo da Smart Dent com a Edge Mini: processo simples, direto e totalmente integrado.
   YouTube: https://www.youtube.com/shorts/7Uuciu5UoLg

5. RayShape Edgemini — Odontologia Digital sem Complicação (Detalhado)
   Vídeo técnico completo: nivelamento automático, engate rápido, plataforma reduzida e normal, resolução clínica superior, tanque magnético, aquecimento, ShapeWare 2.0 IA, conectividade versátil. Tempos: faceta 12 min, coroa 17 min, placa miorrelaxante 38 min, guia cirúrgica 29 min, modelo protético 25 min.
   YouTube: https://www.youtube.com/watch?v=viuqJuGxRLU

6. Demonstração Geral Edge Mini
   YouTube: https://www.youtube.com/watch?v=HyGSOn6gIsw

Instagram Reels da Edge Mini (demonstrações e depoimentos):
- Apresentação técnica Edge Mini: https://www.instagram.com/reel/DN2xZtFakUS/
- Sucesso Rayshape em São Paulo: https://www.instagram.com/reel/DOg5USkjmLd/
- Performance e precisão Edge Mini: https://www.instagram.com/reel/DOggrDoErjn/
- Conheça a RayShape EDGE MINI: https://www.instagram.com/reel/DOb4IGZjIyu/
- Depoimento laboratório — aquisição Edge Mini: https://www.instagram.com/reel/DPPdJ7UiTII/

Para ver os vídeos completos, acesse os links acima ou visite o canal YouTube da SmartDent: https://www.youtube.com/@smartdentbr',
  true
)
ON CONFLICT (title, source_label) DO UPDATE SET content = EXCLUDED.content, active = true;

-- Parte 2: Inserir vídeos YouTube na tabela knowledge_videos
INSERT INTO public.knowledge_videos (title, url, video_type, product_id, product_category, order_index, description)
VALUES
  ('Edge Mini — O Futuro do Atendimento em Consultório', 'https://www.youtube.com/watch?v=Zek71F0Zt8Y', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 3, 'Vídeo institucional da Edge Mini: interface intuitiva, nivelamento automático, plataformas intercambiáveis, resolução 35 µm, próteses híbridas em 20 min.'),
  ('Edge Mini — O Maior Desafio do Dentista Digital', 'https://www.youtube.com/shorts/tmEftJ89Sng', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 4, 'Shorts: dores do dentista digital e como a Edge Mini resolve com nivelamento automático, ShapeWare 2.0 IA, coroa 17 min, faceta 12 min.'),
  ('Edge Mini — Smart Dent + RayShape Apresentam', 'https://www.youtube.com/shorts/LmKWCbLj9vQ', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 5, 'Shorts com specs: nivelamento automático, duas plataformas, aquecimento integrado, precisão 34,4 µm, ShapeWare 2.0 IA.'),
  ('SmartDent — Fluxo Digital Escanear Enviar Imprimir Instalar', 'https://www.youtube.com/shorts/7Uuciu5UoLg', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 6, 'Shorts: fluxo digital completo SmartDent — processo simples, direto e integrado.'),
  ('RayShape Edgemini — Odontologia Digital sem Complicação', 'https://www.youtube.com/watch?v=viuqJuGxRLU', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 7, 'Vídeo técnico completo: nivelamento automático, engate rápido, plataformas, resolução clínica superior, tanque magnético, aquecimento, ShapeWare 2.0 IA. Tempos: faceta 12 min, coroa 17 min, placa 38 min, guia 29 min, modelo 25 min.'),
  ('Edge Mini — Demonstração Geral', 'https://www.youtube.com/watch?v=HyGSOn6gIsw', 'youtube', 'faa43292-9ceb-4441-afc5-4757e88fed3b', 'IMPRESSAO 3D', 8, 'Demonstração geral da impressora 3D Rayshape Edge Mini para odontologia.');
