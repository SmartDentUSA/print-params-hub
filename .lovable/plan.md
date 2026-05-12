## Adicionar botão de upload de mídia no modal de automações

**Arquivo**: `src/components/SmartOpsCSRules.tsx` (seção "Mídia geral", ~linhas 446-483)

**Problema**: Hoje o usuário só consegue colar uma URL no campo "URL da mídia". Não há botão para fazer upload de arquivo.

### Mudanças

1. Adicionar botão **"Upload de arquivo"** ao lado do input "URL da mídia" (mesma linha, layout flex).
2. Botão dispara `<input type="file" hidden>` com `accept` dinâmico conforme `form.tipo`:
   - `image` → `image/*`
   - `audio` → `audio/*`
   - `video` → `video/*`
   - `document` → `application/pdf,.doc,.docx,.xls,.xlsx`
3. Ao selecionar arquivo:
   - Validar tamanho (max 16 MB — limite WhatsApp).
   - Upload para bucket público existente **`whatsapp-media`** em `automations/{timestamp}-{nome-sanitizado}`.
   - Pegar `getPublicUrl` e setar em `form.media_url`.
   - Para `document`, autopreencher `form.media_filename` com nome original.
4. Estado de loading no botão (`uploading`) com `Loader2` enquanto sobe.
5. Toast de sucesso/erro (já usa `sonner`).
6. Mesma adição replicada no bloco WaLeads legado (linhas ~610) para `waleads_media_url` — botão idêntico, salvando no mesmo bucket.

### Detalhes técnicos

- Bucket `whatsapp-media` já existe e é público (confirmado em storage.buckets) — sem nova migration.
- Usar `supabase.storage.from('whatsapp-media').upload(path, file, { upsert: false })`.
- Sanitizar filename: `name.normalize('NFD').replace(/[^a-zA-Z0-9.\-_]/g, '_')`.
- Sem alterações em backend, schema ou edge functions.

### Fora de escopo

- Não mexer em RLS de storage (bucket já público para leitura, write protegido por auth via anon key + policy existente).
- Não alterar lógica de envio das mensagens.
