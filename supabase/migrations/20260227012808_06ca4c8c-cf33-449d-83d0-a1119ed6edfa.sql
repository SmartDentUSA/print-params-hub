
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_scanner_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_impressora_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_software_cad_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_caracterizacao_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_cursos_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_dentistica_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_insumos_lab_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_pos_impressao_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_solucoes_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_marca_impressora_param text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_modelo_impressora_param text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_resina_param text;
