# Renomear cabeçalho da nota do vendedor no PipeRun

Trocar o cabeçalho "🤖 Novo Lead atribuído - Dra. L.I.A." (que aparece logo abaixo do "Nova nota adicionada" gerado pelo próprio PipeRun) por um cabeçalho neutro **"📊 Análise SmartOps"**, sem menção à Dra. L.I.A.

## Escopo

Somente o título da nota de análise/atribuição enviada ao vendedor. Nenhuma outra menção à Dra. L.I.A. (persona do chat, prompts, mensagens ao lead, reativações, etc.) será alterada.

Observação: o texto "Nova nota adicionada" é gerado automaticamente pelo próprio PipeRun ao criar uma Note — não vem do nosso código e não pode ser removido pelo backend.

## Arquivos alterados

1. `supabase/functions/smart-ops-lia-assign/index.ts`
   - Linha 1596 (HTML da nota PipeRun):
     `<b>🤖 Novo Lead atribuído - Dra. L.I.A.</b><br><br>` → `<b>📊 Análise SmartOps</b><br><br>`
   - Linha 1406 (texto WhatsApp para o vendedor):
     `🤖 *Novo Lead atribuído - Dra. L.I.A.*` → `📊 *Análise SmartOps*`

2. `supabase/functions/_shared/waleads-messaging.ts`
   - Linha 310: mesma troca do item acima.

## Não tocar

- Persona/prompts da Dra. L.I.A. (`dra-lia/*`, `lia-guards`, `dra-lia-export`).
- Notas de reativação/regra de ouro que carregam `[Dra. L.I.A.]` como marcador de origem sistêmica (contexto operacional distinto do cabeçalho de vendedor).
- Corpo da nota (lead, contatos, temperatura, etc.) — só o título muda.

## Deploy

Redeploy de `smart-ops-lia-assign` após o patch.
