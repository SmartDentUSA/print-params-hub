UPDATE public.system_a_catalog 
SET extra_data = COALESCE(extra_data, '{}'::jsonb) || '{
  "technical_specs": {
    "capacity": "Até 35 peças por ciclo",
    "cleaning_method": "Ultrassônico + centrifugação",
    "liquid": "Líquido proprietário (sem álcool isopropílico)",
    "cycle_time": "10 minutos",
    "compatibility": "Resinas de alta carga e convencionais"
  },
  "competitor_comparison": {
    "vs_ipa_manual": "Elimina uso de IPA, processo automatizado vs manual",
    "vs_ultrasonic_only": "Centrifugação adicional remove resíduos que ultrassom sozinho não alcança",
    "key_advantage": "Processo padronizado e reprodutível, sem variação de operador"
  },
  "workflow_stages": [
    "Remover peça da impressora",
    "Colocar no NanoClean PoD (até 35 peças)",
    "Ciclo automático de 10 minutos",
    "Peça pronta para pós-cura"
  ]
}'::jsonb,
updated_at = now()
WHERE id = '19bc59de-a1f0-4994-b5ab-4c1a2464b7e0';