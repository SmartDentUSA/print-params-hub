-- Add PDF selection fields to knowledge_contents table
ALTER TABLE knowledge_contents
ADD COLUMN selected_pdf_ids_pt uuid[] DEFAULT '{}',
ADD COLUMN selected_pdf_ids_es uuid[] DEFAULT '{}',
ADD COLUMN selected_pdf_ids_en uuid[] DEFAULT '{}';