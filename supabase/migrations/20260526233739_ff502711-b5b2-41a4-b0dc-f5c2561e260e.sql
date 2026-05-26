
-- 1) Reclassificar: "Resina Smart 3D Print Bio Clear Guide" estava em scanner_intraoral
UPDATE public.workflow_cell_mappings
SET workflow_stage='etapa_3_impressao', workflow_cell='resina'
WHERE workflow_stage='etapa_1_scanner'
  AND workflow_cell='scanner_intraoral'
  AND mapped_label='Resina Smart 3D Print Bio Clear Guide';

-- 2) Reclassificar: "Medit i500 (concorrente)" deve ser competitor, não product
UPDATE public.workflow_cell_mappings
SET mapping_type='competitor', mapped_label='Medit i500', mapped_value='Medit i500'
WHERE mapping_type='product'
  AND mapped_label='Medit i500 (concorrente)';

-- 3) Dedup duplicatas com prefixo verbose (mantém forma canônica "Marca Modelo")
DELETE FROM public.workflow_cell_mappings
WHERE mapping_type='product'
  AND mapped_label IN (
    'Scanner Intraoral MEDIT i600',
    'Scanner Intraoral MEDIT i700 Wireless',
    'Scanner Intraoral MEDIT i900',
    'Scanner Intraoral BLZ INO200',
    'Scanner de Bancada BLZ LS100',
    'Scanner de Bancada Medit T310',
    'IoConnect TruAbutment'
  );

-- 4) "Scanner Intraoral MEDIT i700" (sem Wireless) é modelo separado; renormaliza para "Medit i700"
UPDATE public.workflow_cell_mappings
SET mapped_label='Medit i700', mapped_value='Medit i700'
WHERE mapping_type='product' AND mapped_label='Scanner Intraoral MEDIT i700';

-- 5) Remover dup remanescente caso "Medit i700" já exista após renomear
DELETE FROM public.workflow_cell_mappings a
USING public.workflow_cell_mappings b
WHERE a.ctid < b.ctid
  AND a.workflow_stage=b.workflow_stage
  AND a.workflow_cell=b.workflow_cell
  AND a.mapping_type=b.mapping_type
  AND lower(a.mapped_label)=lower(b.mapped_label);
