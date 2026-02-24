

# Reestruturar Automacoes + Kanban de Reativacao

## 1. Kanban de Reativacao sempre visivel

**Arquivo**: `src/components/SmartOpsKanban.tsx`

- Linha 182: remover condicao `(stagnantLeads.length > 0 || finalLeads.length > 0)` -- renderizar sempre
- Linha 195: remover condicao que esconde EST2/EST3 vazios

---

## 2. Renomear aba

**Arquivo**: `src/components/SmartOpsTab.tsx`
- "Reguas CS" vira "Automacoes"

---

## 3. Reescrever SmartOpsCSRules com suporte completo WaLeads

### Migration SQL

```sql
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id);
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS mensagem_waleads TEXT;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_ativo BOOLEAN DEFAULT false;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS manychat_ativo BOOLEAN DEFAULT true;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_tipo TEXT DEFAULT 'text';
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_media_url TEXT;
```

### Tipos de mensagem WaLeads suportados

A API WaLeads oferece 5 endpoints de envio, todos autenticados via `?key=API_KEY`:

| Tipo | Endpoint | Body |
|---|---|---|
| Texto | `POST /public/message/text` | `{ message, chat }` |
| Imagem | `POST /public/message/image` | `{ url, chat }` (URL publica da imagem) |
| Audio | `POST /public/message/audio` | `{ url, chat }` (URL publica do audio) |
| Video | `POST /public/message/video` | `{ url, chat }` (URL publica do video) |
| Documento | `POST /public/message/document` | `{ url, chat }` (URL publica do arquivo) |

### Novo layout do componente SmartOpsCSRules

Organizado em tres secoes por funcao, com campos para **Trigger Event** e **Produto de Interesse**:

```
Automacoes
├── Vendedores (role = "vendedor")
│   ├── [Membro 1]
│   │   ├── Regra 1: Trigger "novo_lead" | Produto "Vitality" | Delay 0d
│   │   │   ├── [Switch] ManyChat | Template: ___
│   │   │   └── [Switch] WaLeads | Tipo: [text/image/audio/video/document]
│   │   │       ├── Se text: Textarea mensagem
│   │   │       └── Se image/audio/video/document: Input URL da midia
│   │   └── [+ Nova Automacao]
├── CS (role = "cs")
│   └── ...
└── Suporte (role = "suporte")
    └── ...
```

### Modal de criar/editar automacao

Campos:

- **Trigger Event** (Select: novo_lead, ganho, estagnado, perdido)
- **Produto de Interesse** (Input texto livre: Vitality, EdgeMini, etc.)
- **Delay** (numero em dias, 0 = imediato)

Separator -- Secao ManyChat:
- **ManyChat Ativo** (Switch)
- **Template ManyChat** (Input texto)

Separator -- Secao WaLeads:
- **WaLeads Ativo** (Switch)
- **Tipo de Mensagem** (Select: Texto, Imagem, Audio, Video, Documento)
- Se "Texto": **Textarea** para o corpo da mensagem
- Se outro tipo: **Input URL** da midia (URL publica do arquivo)

### Webhook WaLeads (referencia futura)

O WaLeads tambem suporta webhooks que disparam eventos automaticamente:
- `card-move` -- quando card muda de lista
- `card-end` -- quando card e encerrado (com valor de ganho)
- `atm-assign-user` -- quando atendimento e transferido
- `atm-end` -- quando atendimento finaliza
- `tags-change` -- quando tags mudam

Estes webhooks poderao ser integrados futuramente para sincronizar status dos leads automaticamente. Nao serao implementados agora.

---

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar -- colunas `team_member_id`, `mensagem_waleads`, `waleads_ativo`, `manychat_ativo`, `waleads_tipo`, `waleads_media_url` |
| `src/components/SmartOpsTab.tsx` | Editar -- renomear aba |
| `src/components/SmartOpsCSRules.tsx` | Reescrever -- layout por funcao, dual ManyChat/WaLeads com 5 tipos de mensagem |
| `src/components/SmartOpsKanban.tsx` | Editar -- remover condicoes que escondem funis vazios |

