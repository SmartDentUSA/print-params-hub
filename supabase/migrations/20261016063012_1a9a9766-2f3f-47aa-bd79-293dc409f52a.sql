WITH new_products AS (
  INSERT INTO system_a_catalog (external_id, source, category, name, slug, approved, active, visible_in_ui, product_category, product_subcategory)
  VALUES
    (gen_random_uuid()::text, 'system_a', 'product', 'ChairSide Smart A.I. PRO + DMC', 'chairside-smart-ai-pro-dmc', true, true, false, 'Captura Digital', 'Scanner Intraoral'),
    (gen_random_uuid()::text, 'system_a', 'product', 'ChairSide Smart A.I. PRO MEDIT', 'chairside-smart-ai-pro-medit', true, true, false, 'Captura Digital', 'Scanner Intraoral'),
    (gen_random_uuid()::text, 'system_a', 'product', 'ChairSide Smart A.I. PRO MEDIT i700w', 'chairside-smart-ai-pro-medit-i700w', true, true, false, 'Captura Digital', 'Scanner Intraoral'),
    (gen_random_uuid()::text, 'system_a', 'product', 'Kit DMC', 'kit-dmc', true, true, false, 'Captura Digital', 'Acessórios')
  ON CONFLICT DO NOTHING
  RETURNING id, name
),
all_products AS (
  SELECT id, name FROM new_products
  UNION ALL
  SELECT id, name FROM system_a_catalog WHERE name IN ('ChairSide Smart A.I. PRO + DMC','ChairSide Smart A.I. PRO MEDIT','ChairSide Smart A.I. PRO MEDIT i700w','Kit DMC')
)
UPDATE smartops_forms f
SET capture_buttons = COALESCE(f.capture_buttons, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('label','ChairSide - A.I. PRO + DMC','product_name','ChairSide Smart A.I. PRO + DMC','product_catalog_id',(SELECT id FROM all_products WHERE name='ChairSide Smart A.I. PRO + DMC' LIMIT 1),'workflow_stage_target','1_captura_digital__scanner_intraoral'),
  jsonb_build_object('label','ChairSide - A.I. PRO MEDIT','product_name','ChairSide Smart A.I. PRO MEDIT','product_catalog_id',(SELECT id FROM all_products WHERE name='ChairSide Smart A.I. PRO MEDIT' LIMIT 1),'workflow_stage_target','1_captura_digital__scanner_intraoral'),
  jsonb_build_object('label','ChairSide - A.I. PRO MEDIT - i700w','product_name','ChairSide Smart A.I. PRO MEDIT i700w','product_catalog_id',(SELECT id FROM all_products WHERE name='ChairSide Smart A.I. PRO MEDIT i700w' LIMIT 1),'workflow_stage_target','1_captura_digital__scanner_intraoral'),
  jsonb_build_object('label','Scanner Bancada LS 100 + TREINAMENTO','product_name','Scanner de Bancada BLZ LS100','product_catalog_id','7b587299-01db-4399-a3f3-3061d6e8f056','workflow_stage_target','1_captura_digital_scanner_bancada'),
  jsonb_build_object('label','Equipamento UV ShapeCure D','product_name','Equipamento UV ShapeCure D','product_catalog_id','57b40c09-f9a2-4f01-a2da-a9fde8dfe1bd','workflow_stage_target','4_pos_impressao_equipamentos'),
  jsonb_build_object('label','Kit DMC - somente usuários BLZ','product_name','Kit DMC','product_catalog_id',(SELECT id FROM all_products WHERE name='Kit DMC' LIMIT 1),'workflow_stage_target','1_captura_digital__acessorios'),
  jsonb_build_object('label','Tru Abuttment - IoConnect','product_name','ioConnect TruAbutment','product_catalog_id','bea3eb9f-5535-4040-baf7-4a3ce7bc3288','workflow_stage_target','1_captura_digital__acessorios'),
  jsonb_build_object('label','Dispositivo T-Marker compatível com Straumann','product_name','Dispositivo T-Marker compatível com Straumann','product_catalog_id','84571cf0-0a51-45ef-bfcb-471bbb814fc2','workflow_stage_target','1_captura_digital__acessorios'),
  jsonb_build_object('label','Dispositivo T-Marker All-on-T (AOT)','product_name','Dispositivo T-Marker All-on-T (AOT)','product_catalog_id','b1fbbe89-977f-4a47-9331-ab65b2dca696','workflow_stage_target','1_captura_digital__acessorios')
)
WHERE f.id = '98918740-4e99-45f9-bf6d-89cfe90a8c14';