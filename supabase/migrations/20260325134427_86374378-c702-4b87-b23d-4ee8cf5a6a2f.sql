UPDATE lia_attendances
SET piperun_deals_history = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'owner_name' ~ '^\d+$' THEN
        elem || jsonb_build_object('owner_name',
          CASE elem->>'owner_name'
            WHEN '100952' THEN 'Adriano Oliveira'
            WHEN '99582' THEN 'Bruno Souza'
            WHEN '95098' THEN 'Rogerio Junior'
            WHEN '87666' THEN 'Danilo Silva'
            WHEN '82734' THEN 'Olavo Neto'
            WHEN '69958' THEN 'Vinicius Taipeiro'
            WHEN '69319' THEN 'Lucas Azzis'
            WHEN '69316' THEN 'Emerson Junior'
            WHEN '62293' THEN 'Janaine Gusson'
            WHEN '53254' THEN 'José Ricardo Mello'
            WHEN '51543' THEN 'Cicilia'
            WHEN '49361' THEN 'Juliana Guedes'
            WHEN '48555' THEN 'Align - exocad'
            WHEN '48553' THEN 'Rafael Almeida'
            WHEN '47793' THEN 'Rafael Suporte'
            WHEN '47679' THEN 'Heloísa Martins'
            WHEN '47677' THEN 'ADM SMART'
            WHEN '33730' THEN 'Mauro Foltran'
            WHEN '33725' THEN 'Rodrigo Moreira'
            WHEN '33724' THEN 'Ricardo Mello'
            WHEN '33723' THEN 'Daniel Marçal'
            WHEN '33722' THEN 'Nathan Toyama'
            WHEN '33621' THEN 'Equipe Smart Dent'
            ELSE elem->>'owner_name'
          END
        )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(piperun_deals_history::jsonb) elem
),
updated_at = now()
WHERE piperun_deals_history IS NOT NULL
  AND merged_into IS NULL
  AND piperun_deals_history::text ~ '"owner_name"\s*:\s*"\d+"';