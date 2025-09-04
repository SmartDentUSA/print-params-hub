-- Verificar e corrigir os campos que ainda estão como INTEGER
-- Alterar bottom_cure_time para NUMERIC se ainda estiver como INTEGER
DO $$
BEGIN
    -- Verificar se a coluna bottom_cure_time ainda é INTEGER e alterar para NUMERIC
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_sets' 
        AND column_name = 'bottom_cure_time' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.parameter_sets 
        ALTER COLUMN bottom_cure_time TYPE NUMERIC(5,2);
    END IF;
    
    -- Verificar se a coluna cure_time ainda é INTEGER e alterar para NUMERIC
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_sets' 
        AND column_name = 'cure_time' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.parameter_sets 
        ALTER COLUMN cure_time TYPE NUMERIC(5,2);
    END IF;
    
    -- Verificar se a coluna wait_time_before_cure ainda é INTEGER e alterar para NUMERIC
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_sets' 
        AND column_name = 'wait_time_before_cure' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.parameter_sets 
        ALTER COLUMN wait_time_before_cure TYPE NUMERIC(5,2);
    END IF;
    
    -- Verificar se a coluna wait_time_after_cure ainda é INTEGER e alterar para NUMERIC
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_sets' 
        AND column_name = 'wait_time_after_cure' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.parameter_sets 
        ALTER COLUMN wait_time_after_cure TYPE NUMERIC(5,2);
    END IF;
    
    -- Verificar se a coluna wait_time_after_lift ainda é INTEGER e alterar para NUMERIC
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parameter_sets' 
        AND column_name = 'wait_time_after_lift' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.parameter_sets 
        ALTER COLUMN wait_time_after_lift TYPE NUMERIC(5,2);
    END IF;
END $$;