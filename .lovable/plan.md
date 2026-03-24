

# Impacto: Converter Admin de Tabs para Sidebar SaaS

## Situacao Atual

O admin usa **2 niveis de tabs horizontais**:
- **Nivel 1** (`AdminViewSecure.tsx`): 11 tabs — Modelos, Catalogo, Docs, Conteudo, Autores, Ferramentas, Estatisticas, Usuarios, Configuracoes, PandaVideo, **Smart Ops**
- **Nivel 2** (`SmartOpsTab.tsx`): 14 sub-tabs dentro de Smart Ops — Bowtie, Kanban, Equipe, Automacoes, Logs, etc.

Problema: 25+ tabs horizontais com scroll, dificil de navegar, nao escala.

## Proposta: Sidebar com Shadcn Sidebar

Converter para layout SaaS com sidebar lateral colapsavel usando o componente `Sidebar` do shadcn/ui (ja disponivel em `src/components/ui/sidebar.tsx`).

### Estrutura da Sidebar

```text
┌──────────────────┬─────────────────────────────┐
│  SIDEBAR (240px) │  CONTEUDO PRINCIPAL          │
│                  │                              │
│  [Logo]          │                              │
│                  │                              │
│  ▼ Catalogo      │  (componente ativo)          │
│    Modelos       │                              │
│    Produtos      │                              │
│    Docs Sistema  │                              │
│                  │                              │
│  ▼ Conteudo      │                              │
│    Artigos       │                              │
│    Autores       │                              │
│                  │                              │
│  ▼ Smart Ops     │                              │
│    Bowtie        │                              │
│    Leads         │                              │
│    Equipe        │                              │
│    Automacoes    │                              │
│    WhatsApp      │                              │
│    Formularios   │                              │
│    Treinamentos  │ ← novo                      │
│    Copilot       │                              │
│    ...           │                              │
│                  │                              │
│  ▼ Sistema       │                              │
│    Usuarios      │                              │
│    Configuracoes │                              │
│    Estatisticas  │                              │
│                  │                              │
│  [Logout]        │                              │
│  [Voltar ao Site]│                              │
└──────────────────┴─────────────────────────────┘
```

## Impacto nos Arquivos

| Arquivo | Impacto |
|---|---|
| `src/pages/AdminViewSecure.tsx` | **Alto** — Reescrever layout: trocar `Tabs`/`TabsList`/`TabsContent` por `SidebarProvider` + `Sidebar` + state de secao ativa via `useState` ou rotas |
| `src/components/SmartOpsTab.tsx` | **Alto** — Eliminar `Tabs`/`TabsList` internas; cada sub-tab vira item direto na sidebar. O componente pode virar apenas um wrapper ou ser eliminado |
| `src/components/ui/sidebar.tsx` | **Nenhum** — ja existe no projeto |
| Todos os 25+ componentes de conteudo | **Nenhum** — `AdminModels`, `SmartOpsBowtie`, `SmartOpsLeadsList`, etc. continuam identicos, apenas muda quem os renderiza |

## Abordagem de Navegacao

**Opcao recomendada: useState simples** (sem novas rotas)

- Um `useState<string>('models')` controla qual secao esta ativa
- Sidebar renderiza `SidebarMenuButton` com `onClick` que muda o state
- Conteudo principal renderiza o componente correspondente com um switch/map
- Mantem a mesma URL `/admin` (sem sub-rotas)
- Vantagem: zero impacto em roteamento, historico, ou deep-linking existente

## Escopo de Mudanca

- **2 arquivos principais** alterados (`AdminViewSecure.tsx` e `SmartOpsTab.tsx`)
- **0 componentes de conteudo** alterados
- **0 rotas** novas
- Sidebar colapsavel em mobile (mini-mode com icones)
- Grupos colapsaveis (Catalogo, Conteudo, Smart Ops, Sistema)
- Condicional por role (`isAdmin`/`isAuthor`) ja existente, apenas move para sidebar items

## Risco

Baixo. Os componentes de conteudo sao independentes e nao sabem que estao dentro de tabs. A mudanca e puramente de layout/navegacao no `AdminViewSecure.tsx`.

