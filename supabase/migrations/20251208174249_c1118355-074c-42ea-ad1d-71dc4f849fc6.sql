-- Reset documento IFU para forçar re-extração com extrator especializado
UPDATE resin_documents 
SET 
  extracted_text = NULL,
  extraction_status = 'pending',
  extraction_method = NULL,
  extraction_error = NULL,
  extracted_at = NULL,
  extraction_tokens = NULL
WHERE id = 'c79283ad-7bfb-4383-b834-2ff8e12037b6';