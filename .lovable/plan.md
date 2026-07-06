## Objetivo
Adicionar o botão **Conectar WhatsApp** também na seção **Configurações Evolution GO**, abrindo o manager oficial do EvoGo em nova aba.

## Alteração — `src/components/SmartOpsTeam.tsx` (somente frontend)

Logo abaixo do bloco de webhook do EvoGo (antes do botão Salvar), adicionar:

```tsx
<Button
  variant="outline"
  onClick={() => {
    const base = (form.evo_go_base_url?.trim() || "http://82.25.75.61:8081").replace(/\/$/, "");
    const id = form.evo_go_instance_id?.trim();
    const url = id ? `${base}/manager/instances/${id}/settings` : `${base}/manager`;
    window.open(url, "_blank", "noopener,noreferrer");
  }}
  className="w-full"
>
  📱 Conectar WhatsApp (EvoGo)
</Button>
```

- Usa `evo_go_instance_id` se preenchido → abre direto em `/manager/instances/{id}/settings`.
- Se não tiver ID → abre `/manager` do EvoGo.
- Base URL cai para `http://82.25.75.61:8081` quando o campo está vazio (mesma regra do save).
- `noopener,noreferrer` por segurança.

O botão da seção Evolution API existente continua igual (fluxo QR inline).

## O que NÃO muda
- Nada em edge functions, banco, RLS ou lógica de envio.
- Nenhuma outra parte do modal.
