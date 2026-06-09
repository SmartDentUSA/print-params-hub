
ALTER TABLE public.ai_model_routing DROP CONSTRAINT IF EXISTS ai_model_routing_modality_check;
ALTER TABLE public.ai_model_routing ADD CONSTRAINT ai_model_routing_modality_check
  CHECK (modality = ANY (ARRAY['text','multimodal','image','embedding','audio','video']));

INSERT INTO public.ai_model_routing
  (task_type, description, modality, primary_provider, primary_model, fallback_provider, fallback_model,
   input_cost_per_m, output_cost_per_m, max_tokens, temperature, enabled, notes)
VALUES
  ('pdf_extract', 'Extração multimodal de texto de PDFs', 'multimodal',
    'lovable', 'google/gemini-2.5-flash', 'poe', 'gemini-3-flash',
    0.30, 1.20, 12000, 0.2, true, 'Usada por extract-pdf-text / extract-pdf-raw'),
  ('pdf_extract_specialized', 'Extração detalhada de PDFs técnicos', 'multimodal',
    'lovable', 'google/gemini-2.5-pro', 'poe', 'gemini-3.1-pro',
    3.50, 10.50, 16000, 0.2, true, 'Usada por extract-pdf-specialized'),
  ('image_gen', 'Geração de imagens (OG banners, capas)', 'image',
    'lovable', 'google/gemini-2.5-flash-image', 'poe', 'nano-banana-pro',
    0.00, 0.00, 1024, 1.0, true, 'Usada por ai-generate-og-image')
ON CONFLICT (task_type) DO NOTHING;
