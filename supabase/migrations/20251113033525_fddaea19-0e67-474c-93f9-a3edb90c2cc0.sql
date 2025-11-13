-- Add ai_context column to knowledge_contents table for AI generative search optimization
ALTER TABLE knowledge_contents
ADD COLUMN ai_context TEXT;