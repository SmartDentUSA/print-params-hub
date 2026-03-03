
ALTER TABLE public.lia_attendances 
  ADD COLUMN IF NOT EXISTS itens_proposta_parsed jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS equip_scanner text,
  ADD COLUMN IF NOT EXISTS equip_scanner_serial text,
  ADD COLUMN IF NOT EXISTS equip_scanner_ativacao date,
  ADD COLUMN IF NOT EXISTS equip_impressora text,
  ADD COLUMN IF NOT EXISTS equip_impressora_serial text,
  ADD COLUMN IF NOT EXISTS equip_impressora_ativacao date,
  ADD COLUMN IF NOT EXISTS equip_cad text,
  ADD COLUMN IF NOT EXISTS equip_cad_serial text,
  ADD COLUMN IF NOT EXISTS equip_cad_ativacao date,
  ADD COLUMN IF NOT EXISTS equip_pos_impressao text,
  ADD COLUMN IF NOT EXISTS equip_pos_impressao_serial text,
  ADD COLUMN IF NOT EXISTS equip_pos_impressao_ativacao date,
  ADD COLUMN IF NOT EXISTS equip_notebook text,
  ADD COLUMN IF NOT EXISTS equip_notebook_serial text,
  ADD COLUMN IF NOT EXISTS equip_notebook_ativacao date,
  ADD COLUMN IF NOT EXISTS insumos_adquiridos text;
