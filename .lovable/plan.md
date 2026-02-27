

## Mudanças no layout do SmartOpsTab

### Única alteração visual: barra de abas

**Antes (8 abas):**
```text
[Bowtie] [Kanban] [Leads] [Equipe] [Automações] [Logs] [Conteúdo] [Relatórios]
 grid-cols-8
```

**Depois (9 abas):**
```text
[Bowtie] [Kanban] [Leads] [Equipe] [Automações] [Logs] [Conteúdo] [Relatórios] [WhatsApp]
 grid-cols-9
```

### Arquivo `SmartOpsTab.tsx`
- `grid-cols-8` → `grid-cols-9`
- Novo `TabsTrigger value="whatsapp"` com ícone de mensagem
- Novo `TabsContent` renderizando `SmartOpsWhatsAppInbox`

### Novo componente `SmartOpsWhatsAppInbox.tsx`
Layout interno em duas colunas (estilo chat):
```text
┌─────────────────┬──────────────────────────┐
│ Lista conversas │  Histórico de mensagens  │
│ (scroll, filtro)│  (balões in/out)         │
│                 │                          │
│ 📱 5511999...   │  ← msg inbound (cinza)   │
│ 📱 5511888...   │     msg outbound (azul) →│
│                 │                          │
│                 │  [Campo texto] [Enviar]  │
│                 │  [Seletor funcionário ▼] │
└─────────────────┴──────────────────────────┘
```

Nada mais muda no admin — o resto das abas e do layout permanece idêntico.

