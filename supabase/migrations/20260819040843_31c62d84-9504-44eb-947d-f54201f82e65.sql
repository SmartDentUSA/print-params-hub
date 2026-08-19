-- [SmartDent] - Resinas e Insumos
UPDATE public.smartops_forms SET success_redirect_url = 'https://chat.whatsapp.com/LIFvlyBuXgEEH4icQe5jIf'
WHERE slug IN (
  'resina-3d-smartprint-modelo-precision','resina-3d-smartprint-modelo-plus','resina-3d-smartprint-modelo-laqua',
  'resina-3d-smartprint-bio-vitality-all-on-x','resina-3d-smartprint-bio-vitality','resina-3d-smartprint-bio-temp',
  'resina-3d-smartprint-bio-denture','resina-3d-smartprint-bio-clear-guide','resina-3d-smartprint-bio-bite-splint-flex',
  'resina-3d-smartprint-bio-bite-splint-clear','resina-3d-smartprint-bio-bite-splint','resina-3d-smartprint-bio-go-white',
  'resina-3d-smartprint-bio-direct-aligner','software-smart-slicer',
  'nanoclean-pod','nanoclean-clear','nanoclean-caneta','caracterizacao-smart-make',
  'acesso-smart-dent-academy','acess-grupo-smartdent','curso-presencial-imersao-3-dias-chairside',
  'Curso-presencial','print-make-imersao-clinica'
);

-- [SmartDent] - RayShape Edge Mini + ShapeCure
UPDATE public.smartops_forms SET success_redirect_url = 'https://chat.whatsapp.com/KP8x81Pwcyp4ivfX3knTHp'
WHERE slug IN ('impressora-3d-rayshape-edge-mini','equipamento-asiga-cure','equipamento-uv-shapecure-d');

-- [SmartDent] - Dentística e estética
UPDATE public.smartops_forms SET success_redirect_url = 'https://chat.whatsapp.com/FTwQG8oYh3sDGNIIvWDBko'
WHERE slug IN ('caracterizacao-smart-gum','cimento-unikk');

-- [Smart Dent] - Insumos clínicos
UPDATE public.smartops_forms SET success_redirect_url = 'https://chat.whatsapp.com/Ee20FCxw8seJLeW6QX5KGP'
WHERE slug IN ('resina-composta-direta-atos','resina-composta-atos-academic','adesivo-ortodontico-smart-orto');