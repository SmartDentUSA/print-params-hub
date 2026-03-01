-- Step 1: Clear piperun_id from the duplicate (old) record
UPDATE lia_attendances 
SET piperun_id = NULL, piperun_link = NULL
WHERE email = 'rita_castellucci@yahoo.com.br' AND piperun_id = '37733255';

-- Step 2: Set piperun_id on the active record
UPDATE lia_attendances 
SET piperun_id = '37733255', 
    piperun_link = 'https://app.pipe.run/#/deals/37733255'
WHERE id = '21e06309-33aa-4e2f-b325-b3f4e8439238'
  AND piperun_id IS NULL;