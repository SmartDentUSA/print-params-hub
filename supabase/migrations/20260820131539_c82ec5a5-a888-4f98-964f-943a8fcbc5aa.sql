UPDATE public.training_testimonials
SET analysis = COALESCE(analysis, '{}'::jsonb) || jsonb_build_object(
      'usable_for_publication', true,
      'reason_if_not', NULL,
      'identity_confirmed_manually', true,
      'confirmed_participant', 'Lucas Viveiros'
    ),
    status = 'transcribed',
    auto_process = true,
    auto_attempts = 0,
    auto_next_attempt_at = now(),
    auto_last_error = NULL,
    auto_locked_at = NULL,
    review_notes = 'Identidade confirmada manualmente pelo time: Lucas Viveiros (Bauru/SP) — divergência de nome no cadastro liberada.'
WHERE id = 'f522b4d0-9abe-41ee-ba49-dc0168247162';