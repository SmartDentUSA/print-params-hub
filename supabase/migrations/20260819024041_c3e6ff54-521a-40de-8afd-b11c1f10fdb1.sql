update training_testimonials
set status = 'transcribed',
    auto_process = true,
    auto_attempts = 0,
    auto_locked_at = null,
    auto_last_error = null,
    auto_next_attempt_at = now()
where status in ('rag_available','published');