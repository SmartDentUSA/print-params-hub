
# Cérebro Externo — Por Pasta por Categoria (sem API Key para listar subpastas)

## Problema duplo que esta mudança resolve

1. **Erro `GOOGLE_DRIVE_API_KEY`**: A chave ainda não foi configurada no Supabase Secrets, então a edge function falha imediatamente.
2. **UX confusa**: Exigir que o admin configure subpastas com nomes exatos no Drive para o mapeamento automático funcionar é frágil. Qualquer erro de grafia quebra o sync.

A nova abordagem é mais simples e robusta: o admin cola o link de cada pasta diretamente na UI. Zero ambiguidade.

---

## Nova arquitetura

Em vez de 1 pasta raiz → listar subpastas → mapear nomes → categorias:

```text
ANTES (atual):
  ┌─ pasta raiz
  │    └─ subpastas com nomes exactos → mapeamento automático
  └─ GOOGLE_DRIVE_API_KEY obrigatória para listar subpastas

DEPOIS (nova):
  ┌─ SDR        → [campo de link/ID] ← admin cola diretamente
  ├─ Comercial  → [campo de link/ID]
  ├─ Leads      → [campo de link/ID]
  ...
  └─ Geral      → [campo de link/ID]
```

A edge function recebe um array `{ category, folder_id }[]` e processa diretamente cada pasta já com a categoria definida — sem precisar listar subpastas.

---

## Arquivo 1 — `src/components/AdminApostilaImporter.tsx`

### Novos estados
- `driveFolderMap: Record<string, string>` — dicionário `{ sdr: "ID_ou_URL", comercial: "...", ... }`, persistido em `site_settings` como `drive_kb_folder_map` (JSON string)
- Remover: `driveFolderId` (string simples para pasta raiz)
- Manter: `driveSourceLabel`, `driveSyncing`, `driveSyncResult`, `driveSyncLog`, `driveLogLoading`, `cronCopied`

### Funções atualizadas
- `loadSavedDriveConfig()` — carrega `drive_kb_folder_map` (JSON) e `drive_kb_source_label` de `site_settings`
- `saveDriveConfig()` — salva `drive_kb_folder_map` (JSON.stringify do objeto) e `drive_kb_source_label`
- `syncDriveNow()` — envia `{ folder_map: { sdr: "ID", comercial: "ID", ... }, source_label }` para a edge function (em vez de `root_folder_id`)

### Nova seção A — Configuração por categoria
Substituir o único campo de "pasta raiz" por uma tabela compacta com 12 linhas:

```
┌─────────────────────────────────────────────────────────┐
│ 📁 Pasta Raiz (compartilhada por link)                 │
│   ├── 📁 SDR        [link/ID da pasta         ] [✓]    │
│   ├── 📁 Comercial  [link/ID da pasta         ] [✓]    │
│   ├── 📁 Leads      [link/ID da pasta         ] [✓]    │
│   ├── 📁 Clientes   [link/ID da pasta         ] [✓]    │
│   ├── 📁 Campanhas  [link/ID da pasta         ] [✓]    │
│   ├── 📁 Pós-Venda  [link/ID da pasta         ] [✓]    │
│   ├── 📁 FAQ        [link/ID da pasta         ] [✓]    │
│   ├── 📁 Objeções   [link/ID da pasta         ] [✓]    │
│   ├── 📁 Workflow   [link/ID da pasta         ] [✓]    │
│   ├── 📁 Suporte    [link/ID da pasta         ] [✓]    │
│   ├── 📁 Onboarding [link/ID da pasta         ] [✓]    │
│   └── 📁 Geral      [link/ID da pasta         ] [✓]    │
└─────────────────────────────────────────────────────────┘
[Salvar configuração]
```

- Ícone `✓` verde se o campo estiver preenchido, cinza se vazio
- Placeholder: `Link ou ID da pasta (opcional)`
- Categorias não preenchidas são simplesmente ignoradas no sync

### Botão "Sincronizar Agora" — atualizado
Habilitado quando ao menos 1 campo estiver preenchido (em vez de exigir pasta raiz).

---

## Arquivo 2 — `supabase/functions/sync-google-drive-kb/index.ts`

### Mudança na leitura de configuração

**Novo fluxo:**
```typescript
// Do body (sync manual):
const body = await req.json();
const folderMap: Record<string,string> = body.folder_map || {};  // { sdr: "ID", leads: "ID", ... }
const sourceLabel = body.source_label || "Drive KB";

// Se não veio pelo body, tenta site_settings (para cron):
if (!folderMap ou vazio) {
  const setting = await supabase.from("site_settings")
    .select("value").eq("key", "drive_kb_folder_map").maybeSingle();
  Object.assign(folderMap, JSON.parse(setting.value || "{}"));
}
```

**Substituir o bloco de subpastas:**
```typescript
// ANTES: listar subpastas da pasta raiz
const subfolders = await listSubfolders(rootFolderId);
const allFolders = [{ id: rootFolderId, name: "geral" }, ...subfolders];

// DEPOIS: usar diretamente o mapa de pastas
const allFolders = Object.entries(folderMap)
  .filter(([cat, id]) => id?.trim())
  .map(([cat, rawId]) => {
    // extrai ID de URL se necessário
    const match = rawId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return { id: match ? match[1] : rawId.trim(), category: cat };
  });
```

**Remover `folderNameToCategory()`** — não é mais necessária, pois a categoria já vem explicitamente do mapa.

**Loop de processamento** — simplificado:
```typescript
for (const { id: folderId, category } of allFolders) {
  const files = await listFiles(folderId);
  for (const file of files) {
    // extração + ingest com `category` já definida
  }
}
```

**Validação de entrada:**
```typescript
if (Object.keys(allFolders).length === 0) {
  return 400 { error: "Nenhuma pasta configurada em folder_map" };
}
```

### Cron SQL atualizado
O body do cron fica vazio `'{}'::jsonb` — a edge function lê `drive_kb_folder_map` de `site_settings` automaticamente.

---

## O que NÃO muda
- Extração de texto (Google Docs, DOCX, PDF) — inalterada
- `ingest-knowledge-text` — inalterada  
- Log `drive_kb_sync_log` — inalterado (mas `folder_name` agora mostrará o nome da categoria, ex: `"sdr"`)
- Seções B (sync), C (log), D (cron) — inalteradas
- `validCategories` no `ingest-knowledge-text` — inalterada

---

## Nota sobre a GOOGLE_DRIVE_API_KEY
A chave ainda é necessária para chamar a Drive API (listar arquivos dentro de cada pasta, exportar Google Docs como texto, etc.). A mudança elimina apenas a necessidade de **listar subpastas da pasta raiz** — mas a leitura de arquivos dentro de cada pasta ainda usa a API.

O usuário precisa adicionar a `GOOGLE_DRIVE_API_KEY` em **Supabase → Settings → Edge Functions Secrets** com o valor da nova chave (após revogar a exposta no chat). Isso é um pré-requisito independente da mudança de arquitetura.
