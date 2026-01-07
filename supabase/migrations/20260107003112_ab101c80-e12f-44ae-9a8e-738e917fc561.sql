-- Criar bucket para imagens do Knowledge Base
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-images', 'knowledge-images', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (essencial para redes sociais)
CREATE POLICY "Acesso Público para Imagens OG" ON storage.objects
  FOR SELECT USING (bucket_id = 'knowledge-images');

-- Upload autenticado
CREATE POLICY "Upload Autenticado de Imagens" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'knowledge-images');

-- Gerenciamento (regenerar/deletar)
CREATE POLICY "Gerenciamento de Imagens" ON storage.objects
  FOR UPDATE USING (bucket_id = 'knowledge-images');

CREATE POLICY "Deletar Imagens" ON storage.objects
  FOR DELETE USING (bucket_id = 'knowledge-images');

-- Campo alt-text para SEO
ALTER TABLE knowledge_contents 
ADD COLUMN IF NOT EXISTS og_image_alt TEXT;