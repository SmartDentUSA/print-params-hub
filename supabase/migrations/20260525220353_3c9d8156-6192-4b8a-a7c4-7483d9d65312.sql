
UPDATE lia_attendances SET
  manychat_subscriber_id = COALESCE(manychat_subscriber_id, '695289048'),
  manychat_collected_at  = COALESCE(manychat_collected_at, (SELECT manychat_collected_at FROM lia_attendances WHERE id='00d0f892-c2bc-48f2-8355-035a4dd12719')),
  area_atuacao           = COALESCE(area_atuacao, 'CLÍNICA OU CONSULTÓRIO'),
  especialidade          = COALESCE(especialidade, 'ENDODONTISTA'),
  produto_interesse_auto = COALESCE(produto_interesse_auto, 'impressora_3d'),
  produto_interesse_raw  = COALESCE(produto_interesse_raw, 'impressora_3d | RayShape Edge Mini'),
  instagram              = COALESCE(instagram, 'marcy'),
  updated_at             = now()
WHERE id = 'b7d20a3e-1a10-4147-81bb-191e4c4507c0';

UPDATE lia_attendances SET
  merged_into = 'b7d20a3e-1a10-4147-81bb-191e4c4507c0',
  manychat_subscriber_id = NULL,
  updated_at = now()
WHERE id = '00d0f892-c2bc-48f2-8355-035a4dd12719';
