ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_equipamento text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_tipo text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_suporte_descricao text;