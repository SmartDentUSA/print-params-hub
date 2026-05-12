## Goal

Resolver duas frentes em paralelo:

A) **Bug do card Piperun (deal #59699176 — George Felipe)**: campos `Whatsapp`, `Área de Atuação`, `Especialidade` ficaram vazios mesmo com os dados chegando no formulário Meta Lead Ads.

B) **Adicionar seção "CONFIGURAÇÕES EVOLUTION"** no modal Editar Membro (`SmartOpsTeam.tsx`), com instância, provedor, badge de status e botão Conectar WhatsApp (QR + polling).

---

## Parte A — Bug Piperun custom fields

### Diagnóstico

- `supabase/functions/_shared/piperun-field-map.ts` → `mapAttendanceToDealCustomFields` (linha ~954) NÃO inclui `DEAL_CUSTOM_FIELDS.WHATSAPP` (549150). Por isso o campo "Whatsapp" do deal nunca é preenchido, mesmo com `lia_attendances.telefone` válido.
- `area_atuacao` / `especialidade` / `produto_interesse_auto` só são mandados se já estiverem persistidos na linha de `lia_attendances` no momento em que `smart-ops-lia-assign` chama o mapper. Para o lead Meta Lead Ads "# - Impresoras - Smart Dent" o ingest gravou `area_atuacao="Laboratório de Prótese"` mas o webhook Meta provavelmente não preencheu a coluna até depois da criação do deal — confirmar via SELECT na linha desse `piperun_id`.

### Edits planejados

1. **`supabase/functions/_shared/piperun-field-map.ts`**
   - Em `mapAttendanceToDealCustomFields`, adicionar bloco:
     ```ts
     const phoneVal = attendance.telefone_normalized || attendance.telefone;
     if (phoneVal) fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.WHATSAPP, value: String(phoneVal) });
     ```
   - Sem mudanças em `DEAL_CUSTOM_FIELD_HASHES` (hash já existe na linha 224).

2. **`supabase/functions/smart-ops-lia-assign/index.ts`**
   - Antes de chamar `n(lead)`, garantir que o objeto `lead` lido inclui as colunas `telefone`, `telefone_normalized`, `area_atuacao`, `especialidade`, `tem_scanner`, `tem_impressora`, `produto_interesse_auto`. Se o `select` atual estiver enxuto, expandir.
   - Após criar o deal com sucesso, chamar `customFieldsToHashMap` + PUT `/deals/{id}` para reenviar o custom_fields, garantindo que campos populados pós-ingest também cheguem ao Piperun (cobertura para race condition).

3. **Hot-fix do deal #59699176** (somente este lead, via insert/update direto em `lia_attendances` ou chamada manual ao retry endpoint após deploy). Não criar migração para isso — usar a tool de insert/update após o fix.

### Critério de aceite

- Novo lead com phone + área + especialidade preenchidos → custom fields "Whatsapp", "Área de Atuação", "Especialidade" aparecem no card Piperun na primeira sincronização.

---

## Parte B — Seção "CONFIGURAÇÕES EVOLUTION" em SmartOpsTeam.tsx

### Confirmações da exploração

- Componente correto: `src/components/SmartOpsTeam.tsx` (não existe `SmartOpsTeamMembers.tsx`).
- Colunas `team_members.evolution_instance_name` e `team_members.messaging_provider` JÁ existem (vistas em `types.ts`). **Sem migração**.
- Edge function `smart-ops-evolution-manager` **NÃO existe** no projeto. ⚠️ O usuário respondeu "Já existe, só consumir" mas o `ls supabase/functions/` não confirma. Vou implementar **somente o front consumindo o endpoint** (fetch via `supabase.functions.invoke("smart-ops-evolution-manager", { body })`) — se a função não estiver deployada, o badge mostra "Desconectado" e os toasts informam o erro. Caberá ao usuário criá-la (ou pedir explicitamente no próximo turno).

### Edits em `src/components/SmartOpsTeam.tsx`

1. **Estado/form** — estender `useState`:
   - `evolution_instance_name: string`
   - `messaging_provider: "waleads" | "evolution" | "manychat" | "none"` (default `"waleads"`)
   - `evolutionStatus: "open" | "connecting" | "close" | "unknown"`
   - `qrModalOpen: boolean`, `qrCodeBase64: string | null`

2. **Auto-suggest da instância** ao digitar Nome Completo, se `evolution_instance_name` estiver vazio → slugify (lowercase, remove acentos via `normalize("NFD").replace(/[\u0300-\u036f]/g,"")`, replace `\s+` por `_`).

3. **Modal Editar Membro** — após o bloco "Configurações WaLeads" (linha 144), adicionar:
   ```tsx
   <Separator className="my-2" />
   <div className="flex items-center justify-between">
     <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurações Evolution</p>
     <EvolutionStatusBadge status={evolutionStatus} />
   </div>
   <div><Label>Nome da Instância</Label>
     <Input value={form.evolution_instance_name} onChange={...} placeholder="janaina_santos" />
   </div>
   <div><Label>Provedor de mensagens</Label>
     <Select value={form.messaging_provider} onValueChange={...}>
       <SelectItem value="waleads">WaLeads</SelectItem>
       <SelectItem value="evolution">Evolution API</SelectItem>
       <SelectItem value="manychat">ManyChat</SelectItem>
       <SelectItem value="none">Manual</SelectItem>
     </Select>
   </div>
   <Button variant="outline" onClick={connectWhatsApp}>📱 Conectar WhatsApp</Button>
   ```

4. **Badge de status** — componente local que renderiza:
   - 🟢 Conectado (`open`) — verde
   - 🟡 Aguardando QR (`connecting`) — amarelo
   - 🔴 Desconectado (`close` / `unknown` / erro) — vermelho

5. **Hooks**:
   - `useEffect` ao abrir o modal em modo edição → `supabase.functions.invoke("smart-ops-evolution-manager", { body: { action: "get_status", instance_name, member_id } })` → popula `evolutionStatus`.
   - `connectWhatsApp()` → invoca `{ action: "connect_instance", instance_name, member_id }`. Resposta esperada `{ qrcode: string (base64) }`. Abre `qrModalOpen=true` exibindo `<img src={qrcode} />` + texto "Escaneie com o WhatsApp do número {whatsapp_number}". Inicia polling (`setInterval` 3s) chamando `get_status`. Quando `state==="open"` → fecha modal, atualiza badge, toast de sucesso. Timeout de 90s → toast de erro.

6. **handleSave** — incluir `evolution_instance_name` e `messaging_provider` no payload do upsert em `team_members`.

7. **Tabela (linha 159+)** — opcional: adicionar mini-badge na coluna "Integrações" mostrando `EV` quando `messaging_provider === "evolution"` (mesmo padrão do `WL`/`MC`).

### Out of scope

- Não criar/alterar a edge function `smart-ops-evolution-manager` (front consome contrato presumido).
- Não tocar lógica de envio de mensagens (qual provedor é escolhido na hora do disparo).