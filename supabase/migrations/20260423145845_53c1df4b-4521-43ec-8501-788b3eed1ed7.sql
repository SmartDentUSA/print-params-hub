
-- ============================================================
-- SmartDent — Atualização Fonte da Verdade v2.0 (Abril 2026)
-- Apenas atualização de DADOS (sem alterar estrutura nem código)
-- Origem: SmartDent_Fonte_Verdade_v2_Abril2026.docx
-- ============================================================

-- 1) EMPRESA (company_info) — merge profundo do extra_data
UPDATE public.system_a_catalog
SET extra_data = COALESCE(extra_data, '{}'::jsonb)
  || jsonb_build_object(
    'business', COALESCE(extra_data->'business','{}'::jsonb) || jsonb_build_object(
      'legal_name','MMTech Projetos Tecnológicos Importação e Exportação Ltda.',
      'doing_business_as','Smart Dent',
      'cnpj','10.736.894/0001-36',
      'duns','899849957',
      'company_type','Sociedade Limitada (Ltda.)',
      'founded_year',2009,
      'number_of_employees','11-50',
      'sector','Tecnologia em Odontologia Digital',
      'tagline','Construindo o simples',
      'tone_of_voice','Científico, técnico, baseado em evidência, autoridade',
      'origin','Núcleo de Manufatura Avançada (NUMA) — EESC-USP, São Carlos, SP',
      'pioneer_claims', jsonb_build_array(
        'Primeira Central de Usinagem CAD/CAM do Brasil',
        'Primeiras resinas 3D odontológicas desenvolvidas e fabricadas no Brasil',
        '16 anos de P&D próprio — pioneira na odontologia digital brasileira desde 2009'
      ),
      'wikidata_qid','Q139535514',
      'wikidata_url','https://www.wikidata.org/wiki/Q139535514',
      'instagram_handle','@smartdentoficial',
      'instagram_followers','32K+'
    ),
    'wikidata', jsonb_build_object(
      'qid','Q139535514',
      'url','https://www.wikidata.org/wiki/Q139535514',
      'batch_id','256843',
      'batch_status','DONE',
      'batch_date','2026-04-23',
      'declarations', jsonb_build_array(
        jsonb_build_object('property','P31','label','instância de','value','organização'),
        jsonb_build_object('property','P17','label','país','value','Brasil','value_qid','Q155','reference','ANVISA'),
        jsonb_build_object('property','P571','label','data de fundação','value','2009','reference','FAPESP'),
        jsonb_build_object('property','P131','label','localização','value','São Carlos'),
        jsonb_build_object('property','P856','label','site oficial','value','https://www.smartdent.com.br'),
        jsonb_build_object('property','P1278','label','CNPJ','value','10.736.894/0001-36'),
        jsonb_build_object('property','P2505','label','DUNS','value','899849957','reference','accessgudid.nlm.nih.gov'),
        jsonb_build_object('property','P112','label','fundador','value','Marcelo Del Guerra','value_qid','Q139538422','reference','FAPESP'),
        jsonb_build_object('property','P112','label','fundador','value','Marcelo Cestari','value_qid','Q139539600','reference','Lattes + FAPESP')
      )
    ),
    'regulatory_registrations', jsonb_build_object(
      'fda', jsonb_build_object(
        'establishment_registration','3027526455',
        'status','Ativo 2026',
        'duns','899849957',
        'udi_status','In Commercial Distribution desde outubro de 2023',
        'udi_count',12,
        'udi_prefix','D14307560147',
        'sources', jsonb_build_array('accessdata.fda.gov','accessgudid.nlm.nih.gov'),
        'udi_hibcc', jsonb_build_array(
          jsonb_build_object('product','Smart Print Bio Clear Guide','udi','D14307560147454670'),
          jsonb_build_object('product','Smart Print L''Aqua Model','udi','D14307560147451530'),
          jsonb_build_object('product','Smart Print Precision Model','udi','D14307560147453680'),
          jsonb_build_object('product','Smart Print Try-In Castable','udi','D14307560147456890')
        )
      ),
      'anvisa', jsonb_build_object(
        'cnpj','10.736.894/0001-36',
        'total_active_registrations',22,
        'source_url','https://consultas.anvisa.gov.br',
        'registrations', jsonb_build_array(
          jsonb_build_object('product','Smart Print Bio Vitality','registration','81835969003'),
          jsonb_build_object('product','SmartMake','registration','81835969001'),
          jsonb_build_object('product','Atos Resina Composta','registration','81835969004'),
          jsonb_build_object('product','Unikk Veneer LC','registration','81835969014'),
          jsonb_build_object('product','GlazeOn Splint','registration','81835969016'),
          jsonb_build_object('product','Smart Print Aligner','registration','81835969002'),
          jsonb_build_object('product','Smart Ortho','registration','81835969005'),
          jsonb_build_object('product','Atos Unichroma','registration','81835969006'),
          jsonb_build_object('product','Smart Bite','registration','81835969007'),
          jsonb_build_object('product','UNV Bond','registration','81835969013'),
          jsonb_build_object('product','Smart Silano','registration','81835969015'),
          jsonb_build_object('product','Evolith Dissilicato','registration','81835960005'),
          jsonb_build_object('product','Smart Print Bio Clear Guide','registration','81835960001'),
          jsonb_build_object('product','Smart Print Try-In Calcinável','registration','81835960001'),
          jsonb_build_object('product','Smart Print Modelo L''Aqua','registration','81835960006'),
          jsonb_build_object('product','Smart Print Precision Model','registration','81835960006'),
          jsonb_build_object('product','Smart Print Modelo Ocre','registration','81835960006'),
          jsonb_build_object('product','Smart Print Modelo Universal Salmão','registration','81835960006'),
          jsonb_build_object('product','Smart Print Bio Bite Splint Clear','registration','81835969007'),
          jsonb_build_object('product','Smart Print Bio Bite Splint Flex','registration','81835969007'),
          jsonb_build_object('product','Smart Print Bio Denture','registration','81835969003'),
          jsonb_build_object('product','Smart Print Model Plus','registration','81835960006')
        )
      )
    ),
    'certifications', jsonb_build_array(
      jsonb_build_object(
        'standard','ISO 13485:2016',
        'description','Sistema de Gestão da Qualidade para dispositivos médicos',
        'certifier','APCER',
        'certifier_url','https://apcergroup.com/pt/',
        'status','Em processo'
      ),
      jsonb_build_object(
        'standard','ISO 10993',
        'description','Avaliação biológica de dispositivos médicos',
        'certifier','Groupe ICARE (Suíça e França) — laudos GLP',
        'main_product','Smart Print Bio Vitality',
        'status','Concluído — laudos emitidos'
      )
    ),
    'partnerships', jsonb_build_array(
      jsonb_build_object('partner','exocad GmbH','type','Revendedor autorizado — Brasil','relevance','Maior software CAD/CAM odontológico do mundo','url','https://exocad.com/resellers'),
      jsonb_build_object('partner','UNC Charlotte','type','University Business Partner','relevance','Operação dentro do campus — Charlotte NC','url','https://partnerships.charlotte.edu'),
      jsonb_build_object('partner','Groupe ICARE','type','Laboratório GLP','relevance','Testes ISO 10993 — Suíça e França'),
      jsonb_build_object('partner','APCER','type','Certificadora ISO','relevance','ISO 13485:2016 — em processo','url','https://apcergroup.com/pt/')
    ),
    'verified_sources', jsonb_build_array(
      jsonb_build_object('source','FDA Establishment','url','https://accessdata.fda.gov','confirms','Fabricante registrado EUA'),
      jsonb_build_object('source','FDA AccessGUDID/NLM','url','https://accessgudid.nlm.nih.gov','confirms','12 UDIs HIBCC ativos'),
      jsonb_build_object('source','ANVISA','url','https://consultas.anvisa.gov.br','confirms','22 registros vigentes'),
      jsonb_build_object('source','NC Secretary of State','url','https://www.sosnc.gov','confirms','File 2444464 — ativo'),
      jsonb_build_object('source','UNC Charlotte','url','https://partnerships.charlotte.edu','confirms','University Business Partner'),
      jsonb_build_object('source','APCER','url','https://apcergroup.com/pt/','confirms','Certificadora ISO 13485'),
      jsonb_build_object('source','Journal Polymer Science','url','https://doi.org/10.1002/polb.1994.090320902','confirms','979 citações — Cestari'),
      jsonb_build_object('source','FAPESP BV','url','https://bv.fapesp.br','confirms','Projetos PIPE Del Guerra'),
      jsonb_build_object('source','UNESP Portal Docentes','url','https://portaldocentes.unesp.br','confirms','Prof. Weber Ricci'),
      jsonb_build_object('source','ORCID Del Guerra','url','https://orcid.org/0000-0003-1537-3742','confirms','Pesquisador verificado')
    )
  )
WHERE category = 'company_info' AND active = true;

-- 1.b) Atualiza founders preservando estrutura existente, acrescentando Q-numbers e Weber Ricci
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  extra_data,
  '{founders}',
  jsonb_build_array(
    -- Marcelo Del Guerra (atualizado com Q-number e formação real)
    jsonb_build_object(
      'name','Marcelo Del Guerra',
      'title','PhD',
      'role_br','Sócio Diretor',
      'role_us','Manager — MMTech North America LLC',
      'since','2009',
      'orcid','0000-0003-1537-3742',
      'orcid_url','https://orcid.org/0000-0003-1537-3742',
      'lattes_id','8426583815730831',
      'lattes_url','http://lattes.cnpq.br/8426583815730831',
      'fapesp_url','https://bv.fapesp.br/pt/pesquisador/1694/marcelo-del-guerra/',
      'wikidata_qid','Q139538422',
      'wikidata_url','https://www.wikidata.org/wiki/Q139538422',
      'education', jsonb_build_array(
        jsonb_build_object('degree','PhD','field','Engenharia de Produção Mecânica','institution','EESC-USP','years','2006-2009','funding','FAPESP')
      ),
      'highlight_research','FAPESP PIPE nº 2016/21568-3 — Resina dental fotopolimerizável para impressão 3D',
      'knows_about', jsonb_build_array('Engenharia Mecatrônica','Manufatura Avançada','CAD/CAM','Impressão 3D Odontológica','Metrologia'),
      'products_developed', jsonb_build_array('Smart Print Temp','Smart Print Clear Guide','Smart Print Modelo','Smart Print Try In Calcinável','ATOS','Smart Ortho')
    ),
    -- Marcelo Cestari (atualizado com Q-number e publicação destaque)
    jsonb_build_object(
      'name','Marcelo Cestari',
      'title','MSc',
      'role_br','Diretor Químico',
      'role_us','Manager — MMTech North America LLC',
      'since','2010',
      'orcid','0000-0002-1985-209X',
      'orcid_url','https://orcid.org/0000-0002-1985-209X',
      'lattes_id','4312984371086446',
      'lattes_url','http://lattes.cnpq.br/4312984371086446',
      'wikidata_qid','Q139539600',
      'wikidata_url','https://www.wikidata.org/wiki/Q139539600',
      'education', jsonb_build_array(
        jsonb_build_object('degree','MSc','field','Ciência e Engenharia de Materiais','institution','UFSCar','years','1990-1994','funding','CNPq'),
        jsonb_build_object('degree','Especialização','field','Gestão da Produção','institution','UFSCar','years','1995-1996'),
        jsonb_build_object('degree','BSc','field','Química','institution','Universidade de São Paulo (USP)','years','1986-1989')
      ),
      'key_publication', jsonb_build_object(
        'title','Effect of crystallization temperature on the crystalline phase content and morphology of poly(vinylidene fluoride)',
        'journal','Journal of Polymer Science Part B',
        'year',1994,
        'doi','10.1002/polb.1994.090320902',
        'doi_url','https://doi.org/10.1002/polb.1994.090320902',
        'citations',979
      ),
      'award','Representante Local do CIESP — FIESP/CIESP (1995)',
      'knows_about', jsonb_build_array('Engenharia de Materiais','Polímeros','PVDF','Resinas Odontológicas','Próteses de Alta Performance')
    ),
    -- Prof. Dr. Weber Adad Ricci (NOVO — consultor científico)
    jsonb_build_object(
      'name','Prof. Dr. Weber Adad Ricci',
      'title','Prof. Dr.',
      'role_br','Consultor Científico',
      'description','Consultor Clínico / Autor científico referenciado nos artigos',
      'institution','UNESP FOAr — Professor Assistente Doutor, Depto. Odontologia Social',
      'orcid','0000-0003-0996-3201',
      'orcid_url','https://orcid.org/0000-0003-0996-3201',
      'scopus_id','55509352400',
      'scopus_url','https://www.scopus.com/authid/detail.uri?authorId=55509352400',
      'unesp_portal','https://portaldocentes.unesp.br/portaldocentes/docentes/110476',
      'lattes_url','http://lattes.cnpq.br/9477202648340031',
      'publications','Lógica (2020) + Lógica 2 (2022) — best sellers em 60 países',
      'knows_about', jsonb_build_array('Reabilitação Oral','Prótese Dentária','Odontologia Digital','Odontologia Social')
    )
  )
)
WHERE category = 'company_info' AND active = true;

-- 1.c) Atualiza legal_entities — preserva endereço completo + adiciona Q-number USA
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  extra_data,
  '{legal_entities}',
  jsonb_build_array(
    jsonb_build_object(
      'country','BR',
      'legal_name','MMTech Projetos Tecnológicos Importação e Exportação Ltda.',
      'trade_name','Smart Dent',
      'tax_id','10.736.894/0001-36',
      'tax_id_type','CNPJ',
      'founded_year',2009,
      'phone','+55-16-3419-4735',
      'address', jsonb_build_object(
        'street','Rua Doutor Procópio de Toledo Malta, 62',
        'neighborhood','Morada dos Deuses',
        'city','São Carlos',
        'state','SP',
        'postal_code','13562-291',
        'country','BR'
      ),
      'origin','Núcleo de Manufatura Avançada (NUMA) — EESC-USP'
    ),
    jsonb_build_object(
      'country','US',
      'legal_name','MMTech North America LLC',
      'trade_name','Smart Dent USA',
      'company_type','Domestic Limited-Liability Company',
      'state','North Carolina',
      'file_number','2444464',
      'filing_date','2022-06-29',
      'status','Current-Active',
      'governing_agency','North Carolina Secretary of State',
      'source_url','https://www.sosnc.gov/',
      'partnership','UNC Charlotte University Business Partner',
      'partnership_url','https://partnerships.charlotte.edu',
      'registered_agent','Lansden, Charles D.',
      'managers', jsonb_build_array('Marcelo Cestari','Marcelo Del Guerra'),
      'vice_president','Reinaldo Panico Peres',
      'phone','+1-704-755-6220',
      'website','https://smartdentusa.com',
      'address', jsonb_build_object(
        'street','10800 Sikes Place, Suite 230',
        'city','Charlotte',
        'state','NC',
        'postal_code','28277-8130',
        'country','US'
      ),
      'campus_address', jsonb_build_object(
        'street','Grigg Hall 146 — 9320 Robert D. Snyder Road',
        'city','Charlotte',
        'state','NC',
        'postal_code','28223',
        'country','US'
      )
    )
  )
)
WHERE category = 'company_info' AND active = true;

-- 1.d) Responsável Técnico (CRO-SP)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  extra_data,
  '{responsible_technician}',
  jsonb_build_object(
    'name','Ricardo Casale',
    'council','CRO-SP',
    'license_number','78005',
    'role','Responsável Técnico'
  )
)
WHERE category = 'company_info' AND active = true;

-- ============================================================
-- 2) AUTHORS — adiciona Wikidata Q-number nas bios via append em full_bio
--    (não temos coluna wikidata_url; armazenamos em mini_bio quando vazio)
-- ============================================================
UPDATE public.authors
SET specialty = 'Engenharia Mecatrônica · Manufatura Avançada · CAD/CAM · Impressão 3D Odontológica',
    lattes_url = 'http://lattes.cnpq.br/8426583815730831'
WHERE name ILIKE '%Del Guerra%';

UPDATE public.authors
SET specialty = 'Ciência e Engenharia de Materiais · Polímeros · Resinas Odontológicas · Próteses de Alta Performance',
    lattes_url = 'http://lattes.cnpq.br/4312984371086446'
WHERE name ILIKE '%Cestari%';

UPDATE public.authors
SET orcid_url = 'https://orcid.org/0000-0003-0996-3201',
    lattes_url = 'http://lattes.cnpq.br/9477202648340031',
    specialty = 'Reabilitação Oral · Prótese Dentária · Odontologia Digital · UNESP FOAr'
WHERE name ILIKE '%Weber%Ricci%';

-- ============================================================
-- 3) PRODUTOS — popula extra_data->'regulatory' por mapeamento ILIKE
--    Estrutura: { anvisa: '...', wikidata_qid: '...', udi_hibcc?: '...', source: '...' }
-- ============================================================

-- Smart Print Bio Vitality (FDA + ANVISA + Q139540094 já criado)
UPDATE public.system_a_catalog
SET extra_data = COALESCE(extra_data,'{}'::jsonb) || jsonb_build_object(
  'regulatory', jsonb_build_object(
    'anvisa','81835969003',
    'wikidata_qid','Q139540094',
    'wikidata_url','https://www.wikidata.org/wiki/Q139540094',
    'iso_10993_status','Concluído — laudos GLP Groupe ICARE',
    'source_anvisa','https://consultas.anvisa.gov.br'
  )
)
WHERE category = 'product' AND active = true
  AND name ILIKE '%bio vitality%';

-- SmartMake
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969001','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE 'smartmake%';

-- ATOS Resina Composta (todas variações DA/DB/EA/EB/WD/WE/XW + Efeitos)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969004','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843','product_family','Atos Composite Resin'))
WHERE category = 'product' AND active = true
  AND (name ILIKE 'atos resina composta%' OR name ILIKE 'atos block%' OR name ILIKE 'resina%atos%');

-- Atos Unichroma
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969006','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE 'atos unichroma%';

-- Smart Ortho / ATOS Smart Ortho
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969005','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND (name ILIKE '%smart ortho%' OR name ILIKE 'atos smart ortho%');

-- Smart Print Aligner
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969002','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND name ILIKE '%smart print aligner%';

-- Smart Bite (não confundir com Bio Bite Splint)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969007','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND name ILIKE 'smart bite%' AND name NOT ILIKE '%bio bite%';

-- Unikk Veneer LC (resina) e Cimentos UNIKK Veneer
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969014','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND (name ILIKE 'unikk veneer%' OR name ILIKE 'cimento unikk%');

-- GlazeOn Splint
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969016','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE 'glazeon%';

-- UNV Bond
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969013','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND name ILIKE 'unv bond%';

-- Smart Silano
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969015','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND name ILIKE 'smart silano%';

-- Evolith Dissilicato
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835960005','source_anvisa','https://consultas.anvisa.gov.br'))
WHERE category = 'product' AND active = true AND name ILIKE 'evolith%';

-- Smart Print Bio Clear Guide (FDA UDI + ANVISA)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object(
      'anvisa','81835960001',
      'udi_hibcc','D14307560147454670',
      'fda_status','In Commercial Distribution',
      'source_anvisa','https://consultas.anvisa.gov.br',
      'source_fda','https://accessgudid.nlm.nih.gov',
      'wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%bio clear guide%';

-- Smart Print Try-In Calcinável / Castable (FDA UDI + ANVISA)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object(
      'anvisa','81835960001',
      'udi_hibcc','D14307560147456890',
      'fda_status','In Commercial Distribution',
      'source_anvisa','https://consultas.anvisa.gov.br',
      'source_fda','https://accessgudid.nlm.nih.gov',
      'wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND (name ILIKE '%try-in calcin%' OR name ILIKE '%try in calcin%' OR name ILIKE '%try-in castable%');

-- Smart Print Modelo L'Aqua (FDA UDI + ANVISA)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object(
      'anvisa','81835960006',
      'udi_hibcc','D14307560147451530',
      'fda_status','In Commercial Distribution',
      'source_anvisa','https://consultas.anvisa.gov.br',
      'source_fda','https://accessgudid.nlm.nih.gov',
      'wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND (name ILIKE '%l''aqua%' OR name ILIKE '%laqua%');

-- Smart Print Precision Model (FDA UDI + ANVISA)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object(
      'anvisa','81835960006',
      'udi_hibcc','D14307560147453680',
      'fda_status','In Commercial Distribution',
      'source_anvisa','https://consultas.anvisa.gov.br',
      'source_fda','https://accessgudid.nlm.nih.gov',
      'wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%precision model%';

-- Smart Print Modelo Ocre / Ochre Model
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835960006','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND (name ILIKE '%modelo ocre%' OR name ILIKE '%ochre model%');

-- Smart Print Modelo Universal Salmão / Universal Model Salmon
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835960006','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND (name ILIKE '%universal salm%' OR name ILIKE '%universal model salmon%');

-- Smart Print Bio Bite Splint Clear
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969007','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%bio bite splint clear%';

-- Smart Print Bio Bite Splint Flex
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969007','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%bio bite splint flex%';

-- Smart Print Bio Denture (e Translucent)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835969003','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%bio denture%';

-- Smart Print Model Plus
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('anvisa','81835960006','source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843'))
WHERE category = 'product' AND active = true AND name ILIKE '%model plus%';

-- NanoClean PoD (sem ANVISA listado)
UPDATE public.system_a_catalog SET extra_data = COALESCE(extra_data,'{}'::jsonb)
  || jsonb_build_object('regulatory', jsonb_build_object('source_anvisa','https://consultas.anvisa.gov.br','wikidata_batch','256843','note','Sem registro ANVISA listado na fonte da verdade v2.0'))
WHERE category = 'product' AND active = true AND name ILIKE '%nanoclean%';
