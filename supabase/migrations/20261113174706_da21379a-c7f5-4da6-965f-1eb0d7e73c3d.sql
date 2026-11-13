CREATE TABLE public.brand_identity_settings (
  id text PRIMARY KEY DEFAULT 'smartdent',
  brand_name text NOT NULL DEFAULT 'Smart Dent',
  palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  fonts jsonb NOT NULL DEFAULT '[]'::jsonb,
  logos jsonb NOT NULL DEFAULT '[]'::jsonb,
  reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  taglines jsonb NOT NULL DEFAULT '[]'::jsonb,
  voice text NOT NULL DEFAULT '',
  image_style text NOT NULL DEFAULT '',
  image_avoid text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.brand_identity_settings TO anon, authenticated;
GRANT UPDATE ON public.brand_identity_settings TO authenticated;
GRANT ALL ON public.brand_identity_settings TO service_role;
ALTER TABLE public.brand_identity_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand identity is public" ON public.brand_identity_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins edit brand identity" ON public.brand_identity_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.fn_brand_identity_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER trg_brand_identity_touch BEFORE UPDATE ON public.brand_identity_settings FOR EACH ROW EXECUTE FUNCTION public.fn_brand_identity_touch();

INSERT INTO public.brand_identity_settings (id, brand_name, palette, fonts, logos, reference_images, source_files, taglines, voice, image_style, image_avoid) VALUES (
'smartdent', 'Smart Dent',
'[
 {"name":"Azul-marinho Smart Dent","hex":"#363E56","role":"Cor principal: títulos, textos, logo, fundos escuros"},
 {"name":"Laranja Smart Dent","hex":"#E56838","role":"Acento: swoosh do logo, detalhes e destaques pontuais (nunca predominante)"},
 {"name":"Laranja profundo","hex":"#D85C2B","role":"Variação do acento para áreas de cor e hover"},
 {"name":"Azul ardósia","hex":"#546085","role":"Secundária: fundos de peças, blocos de cor, gradientes com o marinho"},
 {"name":"Azul médio","hex":"#6E7A99","role":"Secundária: textos de apoio e ícones"},
 {"name":"Lavanda","hex":"#90A1D6","role":"Apoio: destaques suaves e gráficos"},
 {"name":"Azul acinzentado","hex":"#8B9EB4","role":"Apoio: botões translúcidos e fundos suaves"},
 {"name":"Cinza técnico","hex":"#848996","role":"Neutro: legendas e textos secundários"},
 {"name":"Gelo","hex":"#EDF0F7","role":"Fundo principal claro das peças e páginas"},
 {"name":"Branco","hex":"#FFFFFF","role":"Fundos, bordas finas de vidro e texto sobre escuro"}
]'::jsonb,
'[
 {"family":"Host Grotesk","weights":"300 Light, 600 SemiBold","role":"Títulos de produto e chamadas (ex.: Vitality®, Smart Print Bio) e textos leves","google":"https://fonts.google.com/specimen/Host+Grotesk"},
 {"family":"Poppins","weights":"400 Regular, 600 SemiBold","role":"Títulos institucionais e textos corridos (ex.: Soluções de odontologia digital)","google":"https://fonts.google.com/specimen/Poppins"}
]'::jsonb,
'[
 {"label":"Logo horizontal (fundo claro)","url":"https://admin.smartdent.com.br/__l5e/assets-v1/fdcd82d1-ac4e-4944-b931-884c1dcfdfbc/smartdent-logo-light.png"},
 {"label":"Logo quadrado","url":"https://admin.smartdent.com.br/__l5e/assets-v1/3a814910-f29c-4a81-bc9c-63d7f30efdb9/smartdent-logo-512.png"}
]'::jsonb,
'[
 {"label":"Banner Vitality (site)","url":"https://admin.smartdent.com.br/__l5e/assets-v1/ec78bf1f-a146-4a0a-a5ca-be6cff402a68/smartdent-referencia-banner-vitality.png"},
 {"label":"Posts de referência (Instagram)","url":"https://admin.smartdent.com.br/__l5e/assets-v1/2871169d-42f7-4928-a5dc-01d9285f4364/smartdent-referencia-posts.jpg"},
 {"label":"KV — paletas","url":"https://admin.smartdent.com.br/__l5e/assets-v1/38f82ffa-1058-4c3f-85ac-8424dfc65ff5/smartdent-kv-pagina-1.jpg"},
 {"label":"KV — paleta principal e 16 anos","url":"https://admin.smartdent.com.br/__l5e/assets-v1/6d43b3b4-9ed7-4ff1-8bfe-85edb2a5fb72/smartdent-kv-pagina-2.jpg"},
 {"label":"KV — blocos de cor","url":"https://admin.smartdent.com.br/__l5e/assets-v1/e3c362a1-460a-4a05-ac5d-660c030187c3/smartdent-kv-pagina-3.jpg"},
 {"label":"KV — tipografia","url":"https://admin.smartdent.com.br/__l5e/assets-v1/21a97bf1-5037-4ce5-980a-37794375baf0/smartdent-kv-pagina-4.jpg"},
 {"label":"KV — tipografia e logo","url":"https://admin.smartdent.com.br/__l5e/assets-v1/ab6035b1-7f4b-4413-b936-546a8d412714/smartdent-kv-pagina-5.jpg"},
 {"label":"KV — logo","url":"https://admin.smartdent.com.br/__l5e/assets-v1/1e673534-d742-4f32-8f97-df725b19e464/smartdent-kv-pagina-6.jpg"},
 {"label":"KV — paleta estendida","url":"https://admin.smartdent.com.br/__l5e/assets-v1/29745b38-bff9-47be-837a-e323a3ba60ea/smartdent-kv-pagina-7.jpg"}
]'::jsonb,
'[{"label":"KV VISUAL SMART DENT (Illustrator)","url":"https://admin.smartdent.com.br/__l5e/assets-v1/a23722e5-9b19-4f5a-8127-07d3e0cda4eb/KV_VISUAL_SMART_DENT.ai"}]'::jsonb,
'["Soluções de odontologia digital","Mais que equipamentos ou softwares, entregamos autonomia, entregamos rentabilidade.","Nosso ecossistema otimiza sua hora clínica ou laboratório, tornando a odontologia digital um investimento de altíssimo retorno e viabilidade imediata.","16 anos"]'::jsonb,
'Premium, técnico e confiante. Frases curtas e diretas, foco em resultado clínico, autonomia e rentabilidade. Linguagem para dentistas e laboratórios, sem exageros nem promessas sem prova; certificações (FDA, ANVISA, ISO) citadas como selo de confiança.',
'Estética editorial premium e clínica. Fundo gelo (#EDF0F7) ou degradê suave cinza-azulado com luz difusa de estúdio; alternativa escura em azul-marinho (#363E56) para azul ardósia (#546085). Produto como herói em 3D fotorrealista, nítido, com reflexo suave no piso e muito espaço respirado. Elementos de vidro (glassmorphism): cartões translúcidos com borda branca fina e cantos arredondados, botões em pílula translúcidos ou contornados. Linhas curvas finas brancas como grafismo. Fotos de sorriso em close, pele natural, dentes muito brancos, luz suave. Títulos grandes em azul-marinho (Host Grotesk/Poppins SemiBold, tracking justo) e textos leves (Light/Regular). Logo SMART DENT com swoosh laranja aplicado pequeno, geralmente na vertical em um canto. Laranja (#E56838) só em detalhes.',
'Neon, gradientes roxos ou arco-íris, fundos pretos puros, excesso de laranja, clip-art, ícones genéricos de IA, brilhos exagerados, texto em excesso, tipografias decorativas ou condensadas pesadas, mãos ou dentes deformados, marcas ou rótulos inventados, preços.'
);