
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS hits_e7_insumos integer NOT NULL DEFAULT 0;

UPDATE public.product_taxonomy
   SET subcategory = 'insumos'
 WHERE workflow_stage = 'etapa_7_fresagem'
   AND subcategory = 'insumos_fres';

UPDATE public.product_taxonomy
   SET match_patterns = ARRAY[
     'disco fresagem','bloco cad','bloco zircônia','bloco zirconia',
     'smart zr','smartzr','smart-zr',
     'zirkonzahn','amann','dissilicato','evolith','evolith cad',
     'pmma','wax disc','disco pmma',
     'frese smart-dlc','smart dlc','frese smart dlc',
     'fresa dissilicato','fresa para dissilicato',
     'berço sinterização','berco sinterizacao','berço para sinterização',
     'spray revelador','spray escaneamento',
     'base pigmentação zircônia','base pigmentacao zirconia','base para pigmentação',
     'efeitos pigmentação zircônia','efeitos pigmentacao'
   ]
 WHERE workflow_stage = 'etapa_7_fresagem'
   AND subcategory = 'insumos';
