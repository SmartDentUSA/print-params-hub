## Objetivo

Corrigir o fluxo de geração de QR no modal "Conectar WhatsApp Evolution" (em `src/components/SmartOpsTeam.tsx`) para: auto-preencher `evolution_instance_name` antes da chamada, usar a action correta `get_qr`, tratar `state === 'open'`, exibir erro com debug, e separar polling em `get_status` com janela de 5 minutos.

## Mudanças em `src/components/SmartOpsTeam.tsx`

### 1. Auto-preencher e persistir `evolution_instance_name`
Em `connectWhatsApp`, antes de chamar a edge function:
- Se `form.evolution_instance_name` estiver vazio, gerar via `slugifyName(form.nome_completo)`.
- Atualizar o form (`setForm`) com esse valor.
- Se for um membro existente (`editing?.id`), salvar imediatamente via `supabase.from("team_members").update({ evolution_instance_name }).eq("id", editing.id)` para garantir persistência antes do polling.
- Se não houver `nome_completo` para gerar slug, abortar com toast.

### 2. Trocar action `connect_instance` por `get_qr`
```ts
const { data, error } = await supabase.functions.invoke(
  "smart-ops-evolution-manager",
  { body: { action: "get_qr", instance_name: instanceName, member_id: member.id } }
);
```

### 3. Novo tratamento da resposta
- Adicionar novo state `error: string | null` (substituir uso de toast destrutivo por `setError`).
- Lógica:
  - Se `data?.state === 'open'` → `setEvolutionStatus("open")`, fechar modal, toast de sucesso, **return** (não inicia polling).
  - Se `data?.qrcode` → montar `src` (`data:` ou prefixar `data:image/png;base64,`) e `setQrSrc(src)`. Iniciar polling.
  - Caso contrário → `setError("QR não retornado. Debug: " + JSON.stringify(data))`.

### 4. JSX do Dialog
Substituir o bloco atual ("Gerando QR code…") por:
```tsx
{qrSrc ? (
  <img src={qrSrc} width={256} height={256} alt="QR WhatsApp" className="mx-auto" />
) : error ? (
  <p className="text-destructive text-sm break-all">{error}</p>
) : (
  <div className="flex items-center justify-center gap-2 py-12">
    <Loader2 className="animate-spin h-4 w-4" />
    <span className="text-sm text-muted-foreground">Gerando QR code...</span>
  </div>
)}
```
(usar token `text-destructive` em vez de `text-red-500` para respeitar o design system).

### 5. Polling via `get_status` com janela de 5 minutos
- Mover polling para fora do bloco try inicial; iniciar **apenas após** `qrcode` ser recebido.
- Usar `useRef<NodeJS.Timeout | null>(null)` (`pollingRef`) para guardar o interval.
- `setInterval(checkStatus, 3000)`; parar após `5 * 60 * 1000` ms.
- `checkStatus` invoca `action: 'get_status'`; se `state === 'open'` → `clearInterval`, `setEvolutionStatus('open')`, fechar modal, toast.
- Limpar interval no `onOpenChange={false}` do Dialog e em `useEffect` cleanup do componente.

### 6. Resets ao abrir/fechar modal
Ao abrir: `setQrSrc(null)`, `setError(null)`. Ao fechar: limpar polling.

## Detalhes técnicos

- States novos: `qrSrc: string | null`, `error: string | null`, `pollingRef: useRef`.
- Remover/renomear `qrCodeBase64` para `qrSrc` para alinhar com a especificação.
- Manter `EvolutionStatusBadge` e demais comportamentos existentes.
- `Loader2` já importado de `lucide-react`? Verificar import e adicionar se necessário.
- Nada muda no backend (`smart-ops-evolution-manager`) — assume-se que ele já suporta `action: 'get_qr'` e `action: 'get_status'` retornando `{ qrcode, state }`.

## Fora de escopo

- Edge function `smart-ops-evolution-manager` (não tocar).
- Outros campos do form ou demais ações do componente.
