

## Diagnostico

Na linha 2234 do `dra-lia/index.ts`, a escalation envia para `teamMember.whatsapp_number` (o proprio celular da empresa/vendedor). O correto e enviar para o telefone do **lead** (`attendance.telefone_normalized`), ja que a API Key do WaLeads conectada ao membro ja representa o celular da empresa como remetente.

Fluxo atual (errado):
```text
FROM: celular empresa (waleads_api_key)
TO:   celular empresa (teamMember.whatsapp_number) ← mesmo numero!
```

Fluxo correto:
```text
FROM: celular empresa (waleads_api_key)
TO:   celular do lead (attendance.telefone_normalized)
```

## Plano

### 1. Corrigir `dra-lia/index.ts` — escalation phone target
- Linha 2234: trocar `phone: teamMember.whatsapp_number` por `phone: attendance.telefone_normalized`
- Adicionar validacao: se `attendance.telefone_normalized` estiver vazio, logar warning e nao enviar
- Passar `lead_id: attendance.id` no body para que o `send-waleads` tenha contexto do lead

### 2. Redeployar `dra-lia`
- Deploy e verificar logs na proxima escalation

### Detalhes tecnicos
Apenas 1 linha precisa mudar no `dra-lia/index.ts` (linha 2234). O `send-waleads` ja aceita qualquer `phone` — nao precisa de mudanca.

