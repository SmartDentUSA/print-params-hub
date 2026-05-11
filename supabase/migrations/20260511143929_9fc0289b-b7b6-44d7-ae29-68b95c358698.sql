UPDATE lia_attendances 
SET equip_impressora = NULL,
    tem_impressora = CASE WHEN status_impressora='tem_smartdent' AND tem_impressora='sim' THEN NULL ELSE tem_impressora END,
    status_impressora = CASE WHEN status_impressora='tem_smartdent' THEN NULL ELSE status_impressora END
WHERE merged_into IS NULL 
AND equip_impressora ~* '^(vidro|teflon|resina|fresa|<p>|kit chairside|painel|tela|fep|nfep|pelicula|filme|filtro|cabo|bandeja|cuba|extensao|garantia|treinamento|servi[çc]o|frete|ino\s)';

UPDATE lia_attendances 
SET impressora_modelo = NULL
WHERE merged_into IS NULL 
AND impressora_modelo ~* '^(vidro|teflon|resina|fresa|<p>|kit chairside|painel|tela|fep|nfep|pelicula|filme|filtro|cabo|bandeja|cuba|ino\s)';