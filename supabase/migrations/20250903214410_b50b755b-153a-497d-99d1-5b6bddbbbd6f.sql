-- Verificar se o bucket model-images já existe e criar se não existir
DO $$
BEGIN
  -- Verificar se o bucket já existe
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'model-images') THEN
    -- Criar o bucket model-images
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('model-images', 'model-images', true);
  END IF;
END $$;

-- Criar políticas de acesso para o bucket model-images
-- Política para permitir que qualquer pessoa visualize as imagens (público)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Model images are publicly accessible' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Model images are publicly accessible" 
    ON storage.objects 
    FOR SELECT 
    USING (bucket_id = 'model-images');
  END IF;
END $$;

-- Política para permitir que admins façam upload de imagens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can upload model images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Admins can upload model images" 
    ON storage.objects 
    FOR INSERT 
    WITH CHECK (bucket_id = 'model-images' AND is_admin(auth.uid()));
  END IF;
END $$;

-- Política para permitir que admins atualizem imagens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can update model images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Admins can update model images" 
    ON storage.objects 
    FOR UPDATE 
    USING (bucket_id = 'model-images' AND is_admin(auth.uid()));
  END IF;
END $$;

-- Política para permitir que admins deletem imagens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can delete model images' 
    AND tablename = 'objects' 
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Admins can delete model images" 
    ON storage.objects 
    FOR DELETE 
    USING (bucket_id = 'model-images' AND is_admin(auth.uid()));
  END IF;
END $$;