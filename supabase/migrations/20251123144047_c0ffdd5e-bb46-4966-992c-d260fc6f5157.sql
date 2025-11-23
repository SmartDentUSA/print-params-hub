-- Função auxiliar para converter instruções em Markdown
CREATE OR REPLACE FUNCTION format_instructions_to_markdown(instructions TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  lines TEXT[];
  line TEXT;
  in_pre BOOLEAN := FALSE;
  in_pos BOOLEAN := FALSE;
BEGIN
  IF instructions IS NULL OR instructions = '' THEN
    RETURN NULL;
  END IF;
  
  -- Dividir em linhas
  lines := string_to_array(instructions, E'\n');
  
  FOREACH line IN ARRAY lines
  LOOP
    line := TRIM(line);
    
    -- Ignorar linhas vazias duplicadas
    IF line = '' THEN
      IF result NOT LIKE '%' || E'\n\n' THEN
        result := result || E'\n';
      END IF;
      CONTINUE;
    END IF;
    
    -- Detectar seções principais
    IF line ILIKE '%PRÉ-PROCESSAMENTO%' OR line ILIKE '%PRE-PROCESSAMENTO%' OR line ILIKE '%RÉ-PROCESSAMENTO%' THEN
      in_pre := TRUE;
      in_pos := FALSE;
      result := result || E'\n## PRÉ-PROCESSAMENTO' || E'\n\n';
      CONTINUE;
    END IF;
    
    IF line ILIKE '%PÓS-PROCESSAMENTO%' OR line ILIKE '%POS-PROCESSAMENTO%' THEN
      in_pre := FALSE;
      in_pos := TRUE;
      result := result || E'\n## PÓS-PROCESSAMENTO' || E'\n\n';
      CONTINUE;
    END IF;
    
    -- Detectar subseções (linhas que terminam com :)
    IF line LIKE '%:' OR line LIKE '%：' THEN
      result := result || E'\n### ' || TRIM(TRAILING ':：' FROM line) || E'\n\n';
      CONTINUE;
    END IF;
    
    -- Detectar notas/alertas (linhas com "importante", "atenção", "nota")
    IF line ILIKE '%importante%' OR line ILIKE '%atenção%' OR line ILIKE '%nota:%' OR line ILIKE '%observação%' THEN
      result := result || '> ' || line || E'\n\n';
      CONTINUE;
    END IF;
    
    -- Detectar sub-níveis por indentação ou marcadores existentes
    IF line LIKE '  %' OR line LIKE '    %' OR line LIKE E'\t%' THEN
      -- Sub-nível (2 espaços)
      result := result || '  • ' || LTRIM(line, E' \t-•○◦▪') || E'\n';
    ELSIF line LIKE '-%' OR line LIKE '•%' OR line LIKE '○%' OR line LIKE '◦%' OR line LIKE '▪%' THEN
      -- Já tem marcador, remover e adicionar •
      result := result || '• ' || LTRIM(line, E'-•○◦▪ ') || E'\n';
    ELSE
      -- Linha normal vira bullet
      result := result || '• ' || line || E'\n';
    END IF;
  END LOOP;
  
  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Atualizar todas as resinas que têm instruções
UPDATE resins
SET processing_instructions = format_instructions_to_markdown(processing_instructions)
WHERE processing_instructions IS NOT NULL 
  AND processing_instructions != ''
  AND processing_instructions NOT LIKE '##%';

-- Remover a função auxiliar após o uso
DROP FUNCTION format_instructions_to_markdown(TEXT);