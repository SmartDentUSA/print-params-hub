
-- Delete duplicate rows (keeping the one with highest total_messages for each lowercase email)
DELETE FROM lia_attendances a
USING lia_attendances b
WHERE LOWER(a.email) = LOWER(b.email)
  AND a.id != b.id
  AND (
    a.total_messages < b.total_messages
    OR (a.total_messages = b.total_messages AND a.created_at > b.created_at)
  );

-- Normalize all emails to lowercase
UPDATE lia_attendances SET email = LOWER(email) WHERE email != LOWER(email);

-- Drop the unique constraint and recreate as case-insensitive
ALTER TABLE lia_attendances DROP CONSTRAINT lia_attendances_email_key;
CREATE UNIQUE INDEX lia_attendances_email_ci_key ON lia_attendances (LOWER(email));
