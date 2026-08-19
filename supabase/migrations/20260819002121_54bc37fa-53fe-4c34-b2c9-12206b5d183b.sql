update public.training_testimonials
set status = 'uploaded',
    auto_attempts = 0,
    auto_last_error = null,
    auto_locked_at = null,
    auto_next_attempt_at = now()
where status = 'failed'
  and auto_last_error ilike '%413%';