
# Implementação Completa — Cérebro Externo (Google Drive via API Key Pública)

## Visão geral

5 arquivos modificados/criados em sequência lógica, sem quebrar nenhuma funcionalidade existente.

---

## Pré-requisito: GOOGLE_DRIVE_API_KEY

A secret `GOOGLE_DRIVE_API_KEY` ainda não existe no projeto. Antes de implementar o código, será necessário solicitá-la ao usuário. Ela é uma **chave pública de API** (não OAuth) criada em 2 minutos no Google Cloud Console:

1. Acesse `console.cloud.google.com`
2. Selecione ou crie um projeto
3. Vá em "APIs e serviços" → "Ativar APIs" → ative **Google Drive API**
4. Vá em "Credenciais" → "Criar credencial" → "Chave de API"
5. Copie a chave e adicione como Supabase secret com nome `GOOGLE_DRIVE_API_KEY`

Essa chave não dá acesso a dados privados — serve apenas para quota de requisições. Funciona com qualquer pasta compartilhada por link.

**Importante sobre as pastas:** cada subpasta dentro da pasta raiz também precisa ser compartilhada individualmente com "Qualquer pessoa com o link pode visualizar". O Google Drive API v3 não herda o compartilhamento da pasta pai para os arquivos filhos automaticamente — mas o admin faz isso uma vez ao criar a estrutura.

---

## Arquivo 1 — Migration: `drive_kb_sync_log`

Nova tabela para rastrear cada arquivo processado do Drive, detectar modificações via `modifiedTime` e evitar re-indexação desnecessária.

```sql
CREATE TABLE IF NOT EXISTS public.drive_kb_sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text,
  folder_name   text,
  category      text NOT NULL DEFAULT 'geral',
  source_label  text,
  kb_text_id    uuid REFERENCES public.company_kb_texts(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'pending',
  error_msg     text,
  processed_at  timestamp with time zone,
  modified_time text,
  created_at    timestamp with time zone DEFAULT now()
);

ALTER TABLE public.drive_kb_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage drive sync log"
  ON public.drive_kb_sync_log FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
```

---

## Arquivo 2 — `supabase/functions/ingest-knowledge-text/index.ts`

**Mudança mínima:** linha 99 — expandir `validCategories` de 8 para 12 categorias:

```typescript
// ANTES (linha 99):
const validCategories = ["sdr", "comercial", "workflow", "suporte", "faq", "objecoes", "onboarding", "geral"];

// DEPOIS:
const validCategories = ["sdr", "comercial", "workflow", "suporte", "faq", "objecoes", "onboarding", "geral", "leads", "clientes", "campanhas", "pos_venda"];
```

---

## Arquivo 3 — `supabase/functions/sync-google-drive-kb/index.ts` (novo)

Edge function completamente nova. Lógica:

**Mapeamento de pastas → categorias** (com normalização de acentos):
```typescript
function folderNameToCategory(name: string): string {
  const normalized = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const map: Record<string, string> = {
    'sdr': 'sdr', 'comercial': 'comercial', 'workflow': 'workflow',
    'suporte': 'suporte', 'faq': 'faq', 'objecoes': 'objecoes',
    'onboarding': 'onboarding', 'leads': 'leads', 'clientes': 'clientes',
    'campanhas': 'campanhas', 'pos_venda': 'pos_venda', 'pos_venda': 'pos_venda',
    'geral': 'geral',
  };
  return map[normalized] || 'geral';
}
```

**Fluxo principal:**
1. Lê `root_folder_id` do body (sync manual) ou da tabela `site_settings` (cron)
2. Lista subpastas via `GET /drive/v3/files?q='{id}' in parents AND mimeType='folder'&key={API_KEY}`
3. Para cada subpasta: mapeia nome → categoria, lista arquivos
4. Para cada arquivo: compara `modifiedTime` com `drive_kb_sync_log` — pula se idêntico
5. Extração:
   - Google Docs/DOCX → `GET /drive/v3/files/{id}/export?mimeType=text/plain&key={API_KEY}` (instantâneo)
   - PDF → `GET /drive/v3/files/{id}?alt=media&key={API_KEY}` → base64 → chama `extract-pdf-text`
6. Chama `ingest-knowledge-text` internamente (via fetch com service role)
7. Upserta `drive_kb_sync_log` com status `done` ou `error`
8. Retorna `{ processed, skipped, errors, by_category: { sdr: 2, leads: 1, ... } }`

**Headers das chamadas Drive API** (sem OAuth, sem gateway):
```typescript
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const API_KEY = Deno.env.get('GOOGLE_DRIVE_API_KEY');
// Requisições simples com ?key={API_KEY} na query string
```

---

## Arquivo 4 — `supabase/config.toml`

Adicionar ao final:
```toml
[functions.sync-google-drive-kb]
verify_jwt = false
```

---

## Arquivo 5 — `src/components/AdminApostilaImporter.tsx`

### 5a — Expandir CATEGORIES (linha 67-76)

De 8 para 12 entradas, mantendo `geral` por último:
```typescript
const CATEGORIES = [
  { value: "sdr", label: "SDR" },
  { value: "comercial", label: "Comercial" },
  { value: "workflow", label: "Workflow" },
  { value: "suporte", label: "Suporte" },
  { value: "faq", label: "FAQ" },
  { value: "objecoes", label: "Objeções" },
  { value: "onboarding", label: "Onboarding" },
  { value: "leads", label: "Leads" },
  { value: "clientes", label: "Clientes" },
  { value: "campanhas", label: "Campanhas" },
  { value: "pos_venda", label: "Pós-Venda" },
  { value: "geral", label: "Geral" },
];
```

As 3 abas existentes (Cérebro da L.I.A., Upload Documento) herdam automaticamente as novas categorias nos selects.

### 5b — Novos imports de ícones (linha 11-15)

Adicionar ao import existente do lucide-react: `HardDrive`, `FolderOpen`, `Clock`, `FolderSync`, `Copy`

### 5c — Novos estados para a aba Cérebro Externo

```typescript
const [driveFolderId, setDriveFolderId] = useState("");
const [driveSourceLabel, setDriveSourceLabel] = useState("Drive LIA-Cérebro");
const [driveSyncing, setDriveSyncing] = useState(false);
const [driveSyncResult, setDriveSyncResult] = useState<any>(null);
const [driveSyncLog, setDriveSyncLog] = useState<any[]>([]);
const [driveLogLoading, setDriveLogLoading] = useState(false);
const [driveFolderIdSaved, setDriveFolderIdSaved] = useState("");
const [cronCopied, setCronCopied] = useState(false);
```

### 5d — Funções da aba Cérebro Externo

**`saveDriveConfig()`** — salva `root_folder_id` e `source_label` em `site_settings` via Supabase upsert.

**`syncDriveNow()`** — chama `supabase.functions.invoke("sync-google-drive-kb", { body: { root_folder_id, source_label } })`, armazena resultado em `driveSyncResult`.

**`loadDriveLog()`** — busca `drive_kb_sync_log` ordenado por `processed_at desc`, limit 50, armazena em `driveSyncLog`.

**`copyCronSQL()`** — copia para clipboard o SQL do cron job, seta `cronCopied = true` por 3s.

**`loadSavedConfig()`** — ao montar a aba, lê `site_settings` para pré-preencher o folder ID salvo.

### 5e — 4ª aba na TabsList e TabsContent

**TabsList** vira 4 botões (flex-1 de cada):
```jsx
<TabsTrigger value="drive" className="flex-1 gap-2">
  <HardDrive className="w-4 h-4" />
  Cérebro Externo
</TabsTrigger>
```

**TabsContent value="drive"** com 4 seções:

**Seção A — Configuração:**
- Explicação visual: "Pasta raiz no Google Drive com subpastas por categoria"
- Preview da estrutura de pastas (texto formatado mostrando as 12 categorias)
- Campo "ID ou URL da pasta raiz compartilhada"
- Instrução: "Abra a pasta no Drive → Compartilhar → 'Qualquer pessoa com o link' → copie o ID após `/folders/`"
- Campo "Rótulo de fonte padrão"
- Botão "Salvar configuração"

**Seção B — Sincronização:**
- Botão "Sincronizar Agora" (chama `syncDriveNow`)
- Badge de status após sync: "Processados: X | Ignorados: Y | Erros: Z"
- Resultado por categoria como badges: `SDR: +2 | Leads: +1 | FAQ: 0`
- Loading state com spinner durante sync

**Seção C — Log de arquivos:**
- Botão "Carregar log" (chama `loadDriveLog`)
- Tabela mostrando: tipo (ícone DOCX/PDF) | nome do arquivo | subpasta → categoria | status badge | data
- Status: badge verde "✅ Indexado" / badge vermelho "❌ Erro" / badge amarelo "⏭ Ignorado"

**Seção D — Automação (Cron):**
- Explicação: "Execute o SQL abaixo UMA VEZ no SQL Editor do Supabase (projeto Live) para sincronizar automaticamente a cada 12 horas"
- Bloco `<pre>` com SQL do cron copiável
- Botão "Copiar SQL" com feedback visual (muda para "Copiado ✓" por 3s)

**SQL exibido na UI:**
```sql
SELECT cron.schedule(
  'sync-drive-kb-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/sync-google-drive-kb',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"}'::jsonb,
    body   := '{"triggered_by":"cron"}'::jsonb
  );
  $$
);
```

---

## Sequência de implementação

1. Solicitar `GOOGLE_DRIVE_API_KEY` ao usuário (bloqueante — sem ela a edge function não funciona)
2. Criar migration `drive_kb_sync_log`
3. Atualizar `ingest-knowledge-text` (linha 99 — mudança de 1 linha)
4. Criar `sync-google-drive-kb/index.ts`
5. Atualizar `supabase/config.toml`
6. Atualizar `AdminApostilaImporter.tsx` (categorias + estados + aba nova)

---

## Impacto nas funcionalidades existentes

| Funcionalidade | Impacto |
|---|---|
| Aba Apostila JSON | Zero — inalterada |
| Aba Cérebro da L.I.A. | Positivo — ganha 4 novas categorias nos selects |
| Aba Upload Documento | Positivo — ganha 4 novas categorias nos selects |
| `ingest-knowledge-text` | Mínimo — 1 linha expandida |
| `dra-lia` e RAG | Zero mudança — os novos chunks entram automaticamente no fluxo existente com o multiplicador 2.0x já ativo |

As 3 abas existentes, toda a lógica de indexação e o sistema RAG da L.I.A. permanecem **100% inalterados**.
