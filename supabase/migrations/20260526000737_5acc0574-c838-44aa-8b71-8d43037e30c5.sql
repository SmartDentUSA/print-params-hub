-- Backfill: merge ManyChat duplicates into canonical leads by phone match.
-- Covers Thiago (5dfe6434 → f611bce3) and any other Instagram/ManyChat lead
-- from the last 14 days whose telefone_normalized already exists in a
-- canonical lead with piperun_id.

DO $$
DECLARE
  dup RECORD;
  canon RECORD;
BEGIN
  FOR dup IN
    SELECT id, nome, email, telefone_normalized, manychat_subscriber_id,
           instagram, area_atuacao, especialidade, produto_interesse_auto,
           produto_interesse_raw, manychat_collected_at
    FROM lia_attendances
    WHERE merged_into IS NULL
      AND manychat_subscriber_id IS NOT NULL
      AND telefone_normalized IS NOT NULL
      AND (email LIKE 'mc!_%@instagram.lead' ESCAPE '!'
           OR email LIKE 'mc!_%@manychat.internal' ESCAPE '!')
      AND created_at > now() - interval '14 days'
  LOOP
    SELECT id, nome, email, area_atuacao, especialidade,
           produto_interesse_auto, manychat_subscriber_id, instagram,
           manychat_collected_at, piperun_id
      INTO canon
      FROM lia_attendances
     WHERE merged_into IS NULL
       AND id <> dup.id
       AND telefone_normalized = dup.telefone_normalized
       AND (email NOT LIKE 'mc!_%@instagram.lead' ESCAPE '!')
       AND (email NOT LIKE 'mc!_%@manychat.internal' ESCAPE '!')
     ORDER BY (piperun_id IS NOT NULL) DESC, created_at ASC
     LIMIT 1;

    IF canon.id IS NOT NULL THEN
      -- Smart Merge append-only: só preenche o que está vazio no canônico.
      UPDATE lia_attendances
         SET manychat_subscriber_id = COALESCE(manychat_subscriber_id, dup.manychat_subscriber_id),
             manychat_collected_at  = COALESCE(manychat_collected_at, dup.manychat_collected_at, now()),
             instagram              = COALESCE(instagram, dup.instagram, dup.nome),
             area_atuacao           = COALESCE(area_atuacao, dup.area_atuacao),
             especialidade          = COALESCE(especialidade, dup.especialidade),
             produto_interesse_auto = COALESCE(produto_interesse_auto, dup.produto_interesse_auto),
             produto_interesse_raw  = COALESCE(produto_interesse_raw, dup.produto_interesse_raw),
             crm_creation_blocked   = false,
             updated_at             = now()
       WHERE id = canon.id;

      -- Marca duplicata + libera o índice único do subscriber_id
      UPDATE lia_attendances
         SET merged_into             = canon.id,
             manychat_subscriber_id  = NULL,
             updated_at              = now()
       WHERE id = dup.id;

      INSERT INTO system_health_logs (function_name, severity, error_type, lead_id, details)
      VALUES (
        'migration-manychat-backfill', 'info', 'manychat_merged_into_canonical', canon.id,
        jsonb_build_object(
          'from_lead_id', dup.id,
          'to_lead_id', canon.id,
          'matched_by', 'phone',
          'value', dup.telefone_normalized,
          'subscriber_id', dup.manychat_subscriber_id
        )
      );
    ELSE
      -- Sem canônico — apenas libera o bloqueio de CRM para próximo lia-assign poder rodar.
      UPDATE lia_attendances
         SET crm_creation_blocked = false, updated_at = now()
       WHERE id = dup.id
         AND telefone_normalized IS NOT NULL;
    END IF;
  END LOOP;
END $$;