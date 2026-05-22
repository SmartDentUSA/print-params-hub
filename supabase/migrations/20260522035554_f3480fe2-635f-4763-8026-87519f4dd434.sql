-- Bucket privado para importação offline do PipeRun
INSERT INTO storage.buckets (id, name, public)
VALUES ('piperun-import', 'piperun-import', false)
ON CONFLICT (id) DO NOTHING;

-- Política: apenas service role acessa (default sem políticas = bloqueado para anon, service role bypass RLS)
-- Nada mais a fazer.