-- Limpeza de arquivos órfãos do storage resin-documents
-- Remove apenas arquivos que NÃO têm registro ativo na tabela resin_documents

DO $$
DECLARE
  file_record RECORD;
  active_files TEXT[];
  deleted_count INTEGER := 0;
BEGIN
  -- 1. Obter lista de arquivos ativos
  SELECT ARRAY_AGG(SUBSTRING(file_url FROM '[^/]+$'))
  INTO active_files
  FROM resin_documents 
  WHERE active = true;
  
  -- 2. Deletar arquivos órfãos
  FOR file_record IN 
    SELECT name, (metadata->>'size')::bigint as size
    FROM storage.objects 
    WHERE bucket_id = 'resin-documents'
    AND (active_files IS NULL OR name != ALL(active_files))
  LOOP
    DELETE FROM storage.objects 
    WHERE bucket_id = 'resin-documents' 
    AND name = file_record.name;
    
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Arquivo órfão deletado: % (%.2f MB)', 
      file_record.name, 
      file_record.size::numeric / 1024 / 1024;
  END LOOP;
  
  RAISE NOTICE 'Total de arquivos órfãos removidos: %', deleted_count;
END $$;