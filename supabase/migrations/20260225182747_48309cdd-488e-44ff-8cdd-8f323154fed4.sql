
-- 1. Criar tabela content_requests
CREATE TABLE public.content_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tema text NOT NULL,
  pendencia_original text NOT NULL,
  tipo_conteudo text DEFAULT 'artigo',
  prioridade integer DEFAULT 1,
  frequency integer DEFAULT 1,
  status text DEFAULT 'solicitado',
  source_sessions text[] DEFAULT '{}',
  source_leads text[] DEFAULT '{}',
  produto_relacionado text,
  resolution_note text,
  published_content_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON public.content_requests FOR ALL USING (is_admin(auth.uid()));

-- 3. Trigger de updated_at
CREATE TRIGGER update_content_requests_updated_at
  BEFORE UPDATE ON public.content_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Limpar lixo da agent_knowledge_gaps
-- Remover mensagens curtas sem interrogação (respostas SPIN)
DELETE FROM public.agent_knowledge_gaps
WHERE length(question) < 25 AND question NOT LIKE '%?%';

-- Remover telefones e emails
DELETE FROM public.agent_knowledge_gaps
WHERE question ~ '^\d{10,}$'
   OR question ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}';

-- Remover respostas SPIN conhecidas
DELETE FROM public.agent_knowledge_gaps
WHERE lower(question) IN (
  'implantodontista', 'protesista', 'ortodontista',
  '100% analogico', '100% no analógico', '100% no analógico hoje?',
  '100 % analógico', '100% de laboratrios',
  'já respondi isso', 'ja te respondi isso', 'de novo esta pergunta?',
  'não quero mais nada', 'nunca tive', 'sim mais 1',
  'demora muito?', 'com scanner?', 'já tenho scanner',
  'já tenho um scanner quero comprar outro', 'jantenhonscanner',
  'ja tenho impressora 3d', 'eu nai tenho scanner ainda só tehho impressora',
  'segunda feira as 19>00', 'uns 4000 reais',
  'é marcelo del guerra', 'cadê os cara?',
  'você está online?', 'você esta online?', 'você esta funcionando?',
  'rio de janiero?', 'voc~e alucionou?', 'olá l.i.a.',
  'primeiro consultório', 'implantodontia'
);
