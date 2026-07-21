# Fix: campos do formulário Meta não chegam à nota do PipeRun no fluxo real-time

## Diagnóstico confirmado

Lead `alanteofilo.at@gmail.com` (piperun_id 62054724, form "Meta Ads — [LEADS] - RayShape Edge mini") entrou em 20/07 com `form_data = {}`, `area_atuacao`, `tem_scanner`, `tem_impressora` nulos. Leads posteriores do MESMO formulário (ex.: `sidineimiguel@hotmail.com`, `mkdelma62@gmail.com`) têm todos esses campos preenchidos — porém apenas porque a função **`meta-lead-ads-backfill`** rodou depois (chaves internas `_meta_backfill_ts`, `area_de_atuacao`, `como_digitaliza_suas_moldagens`, `tem_impressora` presentes no `form_data`).

Raiz do bug está em `supabase/functions/meta-lead-ads-pull/index.ts` (linhas 260–306): o payload enviado a `smart-ops-ingest-lead` só carrega `name`, `email`, `phone`, `produto_interesse` e o array bruto `raw_field_data`. As respostas de qualificação (área de atuação, tem impressora, tem scanner, como digitaliza, especialidade, etc.) **NÃO** são passadas como chaves top-level.

Do lado do ingest, `extractField` (linha 24) itera `Object.entries(payload)` procurando substrings — como `raw_field_data` é um array e não um objeto flat, os nomes de campo do Meta nunca ficam visíveis. Resultado: em tempo real, todos os leads Meta entram sem enriquecimento; só o backfill (que tem `pickMetaField` accent-safe sobre `raw_field_data`) preenche. Enquanto o backfill não roda, a nota "Resumo do Lead" cai vazia — foi exatamente o que o usuário viu na Alan.

## Correção

Ajustar apenas o `meta-lead-ads-pull` para achatar `fieldMap` no payload, replicando a mesma lógica do backfill no caminho real-time. Sem tocar em `smart-ops-ingest-lead` (a `extractField` existente já cobre esses aliases, basta enxergá-los como chaves de topo).

Alterações em `supabase/functions/meta-lead-ads-pull/index.ts`:

1. Antes de montar `payload`, construir `formData` (cópia de `fieldMap` com chaves normalizadas: lowercase + remoção de acentos + `_` no lugar de espaço/`?`/`.`). Usar mesma normalização (`normKey`) da `meta-lead-ads-backfill` para casar variações portuguesas (`área_de_atuação` → `area_de_atuacao`).
2. Espalhar `formData` no payload enviado ao ingest e passar `form_data: formData` como objeto explícito para preservar tudo.
3. Manter `raw_field_data` intacto (auditoria).
4. Adicionar log `meta_pull_fields_flattened` com contagem de campos além de nome/email/telefone quando > 0, para observabilidade.

## Verificação

1. Deploy `meta-lead-ads-pull`.
2. Chamar via `curl_edge_functions` com `sinceMinutes=60` para forçar reingest recente e observar em `system_health_logs` o novo log `meta_pull_fields_flattened`.
3. Consultar `lia_attendances` de leads que entraram após o deploy no form "[LEADS] - RayShape Edge mini" e confirmar `area_atuacao`/`tem_impressora`/`form_data` populados sem depender do backfill manual.
4. Rodar `meta-lead-ads-backfill` uma última vez sobre Alan Teofilo para desbloquear a nota atual.

## O que NÃO muda

- `smart-ops-ingest-lead` (extração e Golden Rule intactos).
- `meta-lead-ads-backfill` (segue como rede de segurança).
- `smart-ops-deal-form-note` / template de "Resumo do Lead" (assim que as colunas chegarem preenchidas, a nota se enche automaticamente).
- Janela adaptativa e logs de gap-detector adicionados ontem.
