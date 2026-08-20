UPDATE public.training_testimonials
SET participant_name = 'Lucas Viveiros',
    participant_type = COALESCE(participant_type, 'enrollee'),
    participant_snapshot = COALESCE(participant_snapshot, '{}'::jsonb) || jsonb_build_object(
      'name', 'Lucas Viveiros',
      'lead_id', '7f075de6-b65c-414b-a90d-fec019ab382c',
      'cidade', 'Bauru',
      'uf', 'SP',
      'especialidade', 'IMPLANTODONTISTA',
      'manual_identification', true
    ),
    status = 'transcribed',
    auto_process = true,
    auto_attempts = 0,
    auto_next_attempt_at = now(),
    auto_last_error = NULL,
    auto_locked_at = NULL,
    review_notes = 'Identificação manual confirmada pelo time: depoimento de Lucas Viveiros (Viveiros & Graves, Bauru/SP).'
WHERE id = 'f522b4d0-9abe-41ee-ba49-dc0168247162';