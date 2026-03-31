-- Clean unique keys from merged leads to prevent duplicate key conflicts during sync
UPDATE lia_attendances
SET piperun_id = NULL,
    piperun_link = NULL,
    updated_at = now()
WHERE merged_into IS NOT NULL
  AND (piperun_id IS NOT NULL OR piperun_link IS NOT NULL);

-- Also clear email from merged leads that conflict with their canonical lead
UPDATE lia_attendances AS merged
SET email = NULL,
    updated_at = now()
WHERE merged.merged_into IS NOT NULL
  AND merged.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM lia_attendances AS canonical
    WHERE canonical.id = merged.merged_into
      AND canonical.email = merged.email
  );