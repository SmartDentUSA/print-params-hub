
ALTER TABLE public.smartops_forms
  ADD COLUMN IF NOT EXISTS bg_type text DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS bg_color text,
  ADD COLUMN IF NOT EXISTS bg_color_to text,
  ADD COLUMN IF NOT EXISTS bg_gradient_angle integer DEFAULT 135,
  ADD COLUMN IF NOT EXISTS bg_image_url text,
  ADD COLUMN IF NOT EXISTS bg_overlay_opacity numeric DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS layout_variant text DEFAULT 'split',
  ADD COLUMN IF NOT EXISTS font_heading text DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS font_body text DEFAULT 'Inter',
  ADD COLUMN IF NOT EXISTS button_radius text DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS button_shadow text DEFAULT 'sm',
  ADD COLUMN IF NOT EXISTS extra_sections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_css text;
