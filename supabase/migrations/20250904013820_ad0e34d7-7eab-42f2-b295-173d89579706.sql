-- Alterar campos de tempo de cura para aceitar valores decimais
-- Alterar cure_time de integer para numeric(5,2)
ALTER TABLE public.parameter_sets 
ALTER COLUMN cure_time TYPE NUMERIC(5,2);

-- Alterar bottom_cure_time de integer para numeric(5,2)
ALTER TABLE public.parameter_sets 
ALTER COLUMN bottom_cure_time TYPE NUMERIC(5,2);

-- Alterar wait_time_before_cure para numeric(5,2) se necessário
ALTER TABLE public.parameter_sets 
ALTER COLUMN wait_time_before_cure TYPE NUMERIC(5,2);

-- Alterar wait_time_after_cure para numeric(5,2) se necessário
ALTER TABLE public.parameter_sets 
ALTER COLUMN wait_time_after_cure TYPE NUMERIC(5,2);

-- Alterar wait_time_after_lift para numeric(5,2) se necessário
ALTER TABLE public.parameter_sets 
ALTER COLUMN wait_time_after_lift TYPE NUMERIC(5,2);