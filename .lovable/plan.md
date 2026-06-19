## Plano

### 1. Cron de verificação de backlinks (mensal)
- Agendar `verify-distributor-backlinks-monthly` via `pg_cron`: `15 4 1 * *` (dia 1 de cada mês, 04:15 UTC).
- Job invoca a Edge Function `verify-distributor-backlink` para cada distribuidor ativo (loop SQL `SELECT id FROM distributors WHERE active = true`).
- Manter o botão manual "Verificar backlinks" em `SmartOpsDistributors.tsx` para Fábio rodar sob demanda.
- Nenhum cron diário será criado (o anterior foi interrompido antes de existir).

### 2. Selo Oficial — substituir pelo PNG enviado
- Upload do PNG (`/mnt/user-uploads/SmartDent_Oficial.png`) via `lovable-assets create` → sobrescreve `src/assets/selo-distribuidor-oficial-smart-dent.png.asset.json`.
- `DistributorKitDialog.tsx` já lê esse pointer → selo novo aparece automaticamente nos snippets HTML, em `/distribuidores/{pais}/{slug}` e no kit de imprensa.
- Ajustar o snippet HTML do selo para `width=140 height=140` (proporção quadrada do novo selo) e `alt="Distribuidor Oficial Certificado Smart Dent Brasil"`.

### 3. Documentação
- Atualizar `docs/PITCH_DISTRIBUIDORES_FABIO.md`:
  - Cron mudou de diário para **mensal** (dia 1, 04:15 UTC).
  - Selo oficial agora é o PNG redondo "Distribuidor Oficial · Certificado · Brasil".

### Fora de escopo
- Não mexer em rotas canônicas `/distribuidores/...` (já corretas).
- Não alterar schema, RAG da Dra. LIA, nem JSON-LD da Fase 3.

### Detalhes técnicos
- Migration nova com `cron.schedule('verify-distributor-backlinks-monthly', '15 4 1 * *', $$ ... $$)`.
- Loop chama a edge function via `net.http_post` com `service_role` JWT (mesmo padrão dos outros crons do projeto).
- Pointer `.asset.json` é regerado pelo CLI — não editar manualmente.
