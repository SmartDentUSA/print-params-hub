-- Backfill de traduções EN/ES da Base de Conhecimento.
--
-- Hoje as colunas title_en/es e content_html_en/es só são preenchidas
-- reativamente, quando um visitante real abre o artigo naquele idioma
-- (KnowledgeContentViewer.tsx). Isso deixa /llms-full.txt?lang=en|es e o
-- seo-proxy (servido a bots sem JS, ex.: GPTBot, ClaudeBot) sem tradução
-- real em qualquer artigo que ninguém tenha visitado ainda naquele idioma.
--
-- Este cron chama supabase/functions/backfill-kb-translations a cada 10
-- minutos, processando um lote pequeno (3 artigos) por execução — cada
-- item é uma chamada de IA, por isso o lote é conservador. A função é
-- idempotente: artigos já traduzidos (title_en/es + content_html_en/es
-- preenchidos) são ignorados na busca do próximo lote.
--
-- IMPORTANTE (passo manual pendente): antes deste cron funcionar, é preciso
-- configurar o secret KB_TRANSLATION_CRON_KEY no projeto Supabase com o
-- mesmo valor usado abaixo no header x-cron-key:
--   supabase secrets set KB_TRANSLATION_CRON_KEY=73c8a526e89b3f7acca4e03a573402ba9481519ea81a2deb
-- Sem isso, a função responde 401 e o cron roda sem efeito (visível nos
-- logs de cron.job_run_details).

do $$
begin
  perform cron.unschedule('backfill-kb-translations');
exception when others then
  null; -- job ainda não existia (primeira execução desta migração)
end $$;

select cron.schedule(
  'backfill-kb-translations',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/backfill-kb-translations',
    headers := '{"Content-Type":"application/json","x-cron-key":"73c8a526e89b3f7acca4e03a573402ba9481519ea81a2deb"}'::jsonb,
    body := '{"limit":3}'::jsonb
  );
  $$
);
