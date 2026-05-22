# Extração completa de Deals — API PipeRun

## Objetivo
Puxar **todos os deals** de todos os pipelines diretamente da API do PipeRun (`https://api.pipe.run/v1/deals`) e salvar como artefato baixável em `/mnt/documents/`.

## Como vai funcionar

1. **Token**: usar o secret já existente `PIPERUN_API_KEY` (acessado via env do sandbox).
2. **Script Deno/Node** roda direto no sandbox (não precisa de Edge Function nova — é extração one-shot).
3. **Paginação completa**: percorre `GET /deals?page=N&show=200` até esvaziar, incluindo deals deletados? → **não** (apenas ativos, `deleted=0`). Confirmar se quer incluir deletados.
4. **Campos capturados** por deal: `id`, `title`, `value`, `status` (aberta/ganha/perdida/congelada), `pipeline_id` + nome, `stage_id` + nome, `owner_id` + nome, `person_id` + nome + email + telefone, `company_id` + nome + CNPJ, `origin_id` + nome, `created_at`, `updated_at`, `closed_at`, `last_stage_update`, `custom_fields` (flatten).
5. **Saídas** em `/mnt/documents/`:
   - `piperun_deals_full.csv` — uma linha por deal, colunas planas
   - `piperun_deals_full.json` — payload bruto preservado (para auditoria / re-importação)
   - `piperun_deals_summary.txt` — totais por pipeline / status / owner
6. **Resumo no chat**: total de deals, breakdown por pipeline e por status (ganha/perdida/aberta), top 10 owners.

## Perguntas antes de rodar
- **Incluir deals deletados?** (padrão: não)
- **Limitar a algum pipeline?** Ex: só Vendas (id 458625), ou todos? (padrão: todos)
- **Quer apenas extrair o snapshot agora**, ou também já **cruzar com `lia_attendances` no Supabase** marcando match/no-match (similar ao Rayshape)?

## Tempo estimado
~5-15 min de execução dependendo do volume (PipeRun limita ~200/page e tem rate limit ~60 req/min).

## Não-objetivos
- Não cria Edge Function nova.
- Não modifica `lia_attendances`.
- Não altera UI.
