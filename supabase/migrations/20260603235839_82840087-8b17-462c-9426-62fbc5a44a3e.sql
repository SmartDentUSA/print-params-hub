DO $$
DECLARE
  v_id uuid;
  v_slug text;
  v_name text;
  v_cat text;
  v_subcat text;
  v_form_id uuid;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('BLZ Dental DMC', 'blz-dental-dmc', 'Acessórios', 'Captura Digital', '1274f2ae-1c3e-4030-909f-df08ebb77a7f'::uuid),
      ('Scanner Intraoral BLZ Leap 500', 'scanner-intraoral-blz-leap-500', 'Scanners', 'Intraoral', '0080b882-c563-42fa-a5f2-e7ece76d78c4'::uuid),
      ('ShapeCure D — Pós-Cura UV', 'shapecure-d-pos-cura-uv', 'Equipamentos', 'Pós-Cura', '0a63a104-c927-4780-812f-fe2a4ad45cdc'::uuid),
      ('Resina 3D Smart Print Bio Direct Aligner', 'resina-3d-smart-print-bio-direct-aligner', 'Resinas', 'Ortodontia', '47f1bca2-0a10-42b5-9565-f5a5050f70e2'::uuid),
      ('Resina 3D Smart Print Bio GOWhite', 'resina-3d-smart-print-bio-gowhite', 'Resinas', 'Estética', '4bcd75ef-728f-4d52-b394-90268fbd16dc'::uuid),
      ('Software Smart Slicer', 'software-smart-slicer', 'Software', 'Slicer 3D', 'aa835196-4840-4897-95a3-fec57578445b'::uuid),
      ('Serviço de Terceirização de Projetos CAD', 'servico-terceirizacao-projetos-cad', 'Serviços', 'CAD', '0801737c-75bb-4ac1-ad64-bcb6c7406b7e'::uuid)
    ) AS t(name, slug, cat, subcat, form_id)
  LOOP
    v_id := gen_random_uuid();
    INSERT INTO system_a_catalog (id, external_id, name, slug, category, product_category, product_subcategory, active, approved, visible_in_ui, source, created_at, updated_at)
      VALUES (v_id, rec.slug, rec.name, rec.slug, rec.cat, rec.cat, rec.subcat, true, true, true, 'manual', now(), now());
    INSERT INTO products_catalog (product_id, name, category, subcategory, clinical_brain_status, synced_at)
      VALUES (v_id::text, rec.name, rec.cat, rec.subcat, 'pending', now());
    UPDATE smartops_forms SET product_catalog_id = v_id WHERE id = rec.form_id;
  END LOOP;
END $$;