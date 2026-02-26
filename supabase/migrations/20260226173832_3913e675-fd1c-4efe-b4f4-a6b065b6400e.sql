-- Fix raw numeric stage IDs in lia_attendances.ultima_etapa_comercial
UPDATE lia_attendances SET ultima_etapa_comercial = 'cs_em_espera' WHERE ultima_etapa_comercial = '535465';
UPDATE lia_attendances SET ultima_etapa_comercial = 'cs_sem_data_agendar' WHERE ultima_etapa_comercial = '523977';