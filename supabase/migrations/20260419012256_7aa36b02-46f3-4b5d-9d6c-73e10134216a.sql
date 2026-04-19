-- Onda 1: Source of Truth — atualizar dados corporativos e fundadores

-- 1. Atualizar credenciais acadêmicas dos fundadores
UPDATE public.authors SET 
  orcid_url = 'https://orcid.org/0000-0003-1537-3742',
  academic_title = 'PhD',
  fapesp_url = COALESCE(fapesp_url, 'https://bv.fapesp.br/pt/pesquisador/1694/marcelo-del-guerra/')
WHERE id = 'e35f1b00-01ab-46c5-bdec-20e532926068';

UPDATE public.authors SET 
  orcid_url = 'https://orcid.org/0000-0002-1985-209X',
  lattes_url = 'http://lattes.cnpq.br/4312984371086446',
  academic_title = 'MSc'
WHERE id = '31a2debe-d4a9-44d7-8b0d-984fa7cb59ce';

-- 2. Atualizar dados corporativos (Source of Truth) em system_a_catalog
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(extra_data, '{}'::jsonb),
          '{business}',
          jsonb_build_object(
            'legal_name', 'MMTech Projetos Tecnológicos Importação e Exportação Ltda.',
            'doing_business_as', 'Smart Dent',
            'cnpj', '10.736.894/0001-36',
            'company_type', 'Sociedade Limitada (Ltda.)',
            'founded_year', 2009,
            'sector', 'Tecnologia em Odontologia Digital',
            'number_of_employees', '40+'
          )
        ),
        '{legal_entities}',
        '[
          {
            "country": "BR",
            "legal_name": "MMTech Projetos Tecnológicos Importação e Exportação Ltda.",
            "trade_name": "Smart Dent",
            "tax_id_type": "CNPJ",
            "tax_id": "10.736.894/0001-36",
            "founded_year": 2009,
            "address": {
              "street": "Rua Doutor Procópio de Toledo Malta, 62",
              "neighborhood": "Morada dos Deuses",
              "city": "São Carlos",
              "state": "SP",
              "postal_code": "13562-291",
              "country": "BR"
            },
            "phone": "+55-16-3419-4735"
          },
          {
            "country": "US",
            "legal_name": "MMTech North America LLC",
            "trade_name": "Smart Dent USA",
            "company_type": "Domestic Limited-Liability Company",
            "state": "North Carolina",
            "file_number": "2444464",
            "filing_date": "2022-06-29",
            "status": "Current-Active",
            "governing_agency": "North Carolina Secretary of State",
            "address": {
              "street": "10800 Sikes Place, Suite 230",
              "city": "Charlotte",
              "state": "NC",
              "postal_code": "28277-8130",
              "country": "US"
            },
            "campus_address": {
              "street": "Grigg Hall 146 — 9320 Robert D. Snyder Road",
              "city": "Charlotte",
              "state": "NC",
              "postal_code": "28223",
              "country": "US"
            },
            "registered_agent": "Lansden, Charles D.",
            "managers": ["Marcelo Cestari", "Marcelo Del Guerra"],
            "vice_president": "Reinaldo Panico Peres",
            "phone": "+1-704-755-6220",
            "website": "https://smartdentusa.com",
            "partnership": "UNC Charlotte University Business Partner",
            "source_url": "https://www.sosnc.gov/"
          }
        ]'::jsonb
      ),
      '{responsible_technician}',
      '{
        "name": "Ricardo Casale",
        "council": "CRO-SP",
        "license_number": "78005"
      }'::jsonb
    ),
    '{founders}',
    '[
      {
        "name": "Marcelo Del Guerra",
        "title": "PhD",
        "role_br": "Sócio Diretor",
        "role_us": "Manager — MMTech North America LLC",
        "since": 2009,
        "orcid": "0000-0003-1537-3742",
        "orcid_url": "https://orcid.org/0000-0003-1537-3742",
        "lattes_id": "8426583815730831",
        "lattes_url": "http://lattes.cnpq.br/8426583815730831",
        "fapesp_url": "https://bv.fapesp.br/pt/pesquisador/1694/marcelo-del-guerra/",
        "education": [
          {"degree": "PhD", "field": "Engenharia de Produção Mecânica", "institution": "EESC-USP", "years": "2006-2009", "funding": "FAPESP"},
          {"degree": "MSc", "field": "Manufatura", "institution": "EESC-USP (NUMA)", "years": "2002-2004", "funding": "CAPES"},
          {"degree": "BSc", "field": "Engenharia Mecatrônica", "institution": "EESC-USP", "years": "1997-2001", "funding": "CNPq"},
          {"degree": "Pós-Doutorado", "field": "Engenharia Mecânica / Materiais Odontológicos", "institution": "MMTech", "years": "2013-2015", "funding": "CNPq"}
        ],
        "knows_about": ["Engenharia Mecatrônica", "Manufatura Avançada", "CAD/CAM", "Impressão 3D Odontológica", "Metrologia"],
        "products_developed": ["Smart Print Temp", "Smart Print Clear Guide", "Smart Print Modelo", "Smart Print Try In Calcinável", "ATOS", "Smart Ortho"]
      },
      {
        "name": "Marcelo Cestari",
        "title": "MSc",
        "role_br": "Diretor Químico",
        "role_us": "Manager — MMTech North America LLC",
        "since": 2010,
        "orcid": "0000-0002-1985-209X",
        "orcid_url": "https://orcid.org/0000-0002-1985-209X",
        "lattes_id": "4312984371086446",
        "lattes_url": "http://lattes.cnpq.br/4312984371086446",
        "education": [
          {"degree": "MSc", "field": "Ciência e Engenharia de Materiais", "institution": "UFSCar", "years": "1990-1994", "funding": "CNPq"},
          {"degree": "Especialização", "field": "Gestão da Produção", "institution": "UFSCar", "years": "1995-1996"},
          {"degree": "BSc", "field": "Química", "institution": "Universidade de São Paulo (USP)", "years": "1986-1989"}
        ],
        "knows_about": ["Engenharia de Materiais", "Polímeros", "PVDF", "Resinas Odontológicas", "Próteses de Alta Performance"],
        "key_publication": {
          "title": "Effect of crystallization temperature on the crystalline phase content and morphology of poly(vinylidene fluoride)",
          "year": 1994,
          "citations": 979
        },
        "award": "Representante Local do CIESP — FIESP/CIESP (1995)"
      }
    ]'::jsonb
  ),
  '{research_grants}',
  '[
    {"title": "Resina dental acrílica líquida fotopolimerizável para impressão 3D/DLP (Smart Print)", "funder": "FAPESP", "program": "PIPE", "grant_id": "2016/21568-3", "period": "2018-2020"},
    {"title": "Discos CoCr por metalurgia do pó para CAD-CAM — Fase 3", "funder": "FAPESP", "program": "PIPE Fase 3", "period": "2016-2018"},
    {"title": "Discos CoCr para infraestruturas odontológicas via CAD-CAM — Fase 2", "funder": "FAPESP", "program": "PIPE Fase 2", "period": "2013-2015"},
    {"title": "Blocos de zircônia Y-TZP para CAD-CAM odontológico", "funder": "CNPq", "grant_id": "300245/2013", "period": "2013-2015"},
    {"title": "Discos CoCr via metalurgia do pó — Fase 1", "funder": "MCT/CNPq", "grant_id": "561320/2010-1", "program": "RHAE Edital 62/2009", "period": "2011-2013"}
  ]'::jsonb
)
WHERE category = 'company_info' AND active = true;

-- 3. Corrigir endereço/contato no nível superior do extra_data (contact)
UPDATE public.system_a_catalog
SET extra_data = jsonb_set(
  COALESCE(extra_data, '{}'::jsonb),
  '{contact}',
  COALESCE(extra_data->'contact', '{}'::jsonb) || jsonb_build_object(
    'address', 'Rua Doutor Procópio de Toledo Malta, 62 — Morada dos Deuses',
    'city', 'São Carlos',
    'state', 'SP',
    'postal_code', '13562-291',
    'country', 'BR',
    'phone', '+55-16-3419-4735',
    'phone_us', '+1-704-755-6220'
  )
)
WHERE category = 'company_info' AND active = true;