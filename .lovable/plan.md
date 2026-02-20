
# Adicionar GOOGLE_DRIVE_API_KEY e Implementar o Cérebro Externo

## Pré-requisito imediato

A chave compartilhada no chat deve ser **revogada e substituída** por uma nova antes de ser usada, pois ficou exposta no histórico. Após criar a nova chave no Google Cloud Console, ela precisa ser adicionada como secret no Supabase com o nome exato `GOOGLE_DRIVE_API_KEY`.

Confirmada a adição do secret, implementamos os 4 arquivos restantes do plano aprovado:

---

## Arquivo 1 — `supabase/functions/ingest-knowledge-text/index.ts`

Mudança de 1 linha na linha 99:

```typescript
// ANTES:
const validCategories = ["sdr", "comercial", "workflow", "suporte", "faq", "objecoes", "onboarding", "geral"];

// DEPOIS:
const validCategories = ["sdr", "comercial", "workflow", "suporte", "faq", "objecoes", "onboarding", "geral", "leads", "clientes", "campanhas", "pos_venda"];
```

---

## Arquivo 2 — `supabase/functions/sync-google-drive-kb/index.ts` (novo)

Edge function completa. Destaques:

- `folderNameToCategory()` normaliza acentos e mapeia nomes como "Pós-Venda" → `pos_venda`, "Objeções" → `objecoes`
- Sync incremental: compara `modifiedTime` da API do Drive com `drive_kb_sync_log.modified_time` e pula arquivos não modificados
- Google Docs e DOCX: extrai via `export?mimeType=text/plain` (sem dependência externa)
- PDF: baixa como binário, converte para base64, envia para a edge function `extract-pdf-text` já existente
- Chama `ingest-knowledge-text` internamente com `SUPABASE_SERVICE_ROLE_KEY` (não precisa de JWT do usuário)
- Retorna `{ processed, skipped, errors, by_category: { sdr: 2, leads: 1, ... } }`
- Configuração via body (`root_folder_id`) para sync manual, ou via `site_settings` key `drive_kb_root_folder_id` para o cron

---

## Arquivo 3 — `supabase/config.toml`

Adicionar ao final:

```toml
[functions.sync-google-drive-kb]
verify_jwt = false
```

---

## Arquivo 4 — `src/components/AdminApostilaImporter.tsx`

Quatro alterações sem tocar nas abas existentes:

**Imports:** adicionar `HardDrive`, `FolderOpen`, `Clock`, `RefreshCw`, `Copy` ao import do lucide-react

**CATEGORIES:** expandir de 8 para 12 categorias, inserindo `leads`, `clientes`, `campanhas`, `pos_venda` antes de `geral`

**Estados e funções novas:**
- `driveFolderId`, `driveSourceLabel`, `driveSyncing`, `driveSyncResult`, `driveSyncLog`, `driveLogLoading`, `cronCopied`
- `loadSavedDriveConfig()` — carrega config salva de `site_settings` ao abrir a aba
- `saveDriveConfig()` — upserta `drive_kb_root_folder_id` e `drive_kb_source_label` em `site_settings`
- `syncDriveNow()` — invoca `sync-google-drive-kb` com o folder ID configurado
- `loadDriveLog()` — lê `drive_kb_sync_log` ordenado por `processed_at desc`, limit 50
- `copyCronSQL()` — copia SQL para clipboard, feedback visual 3s

**4ª aba "Cérebro Externo"** com 4 seções:

- Seção A — Configuração: campo ID/URL da pasta raiz + campo rótulo de fonte + botão salvar
- Seção B — Sincronização: botão "Sincronizar Agora" com spinner, badges de resultado por categoria
- Seção C — Log: tabela com nome do arquivo, subpasta → categoria, status (Indexado / Erro / Ignorado) e data
- Seção D — Cron: bloco SQL copiável para `pg_cron` executar sync a cada 12h automaticamente

---

## Sequência de execução

1. Usuário revoga a chave exposta e cria uma nova no Google Cloud Console
2. Usuário adiciona o secret `GOOGLE_DRIVE_API_KEY` no Supabase
3. Implementar os 4 arquivos acima em paralelo
4. Deploy automático das edge functions

