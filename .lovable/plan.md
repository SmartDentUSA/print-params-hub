

# Plano: Adicionar Botões de Sync PipeRun na UI Admin

## Problema

Quando o layout do admin foi refatorado de `SmartOpsTab` (com tabs) para o sidebar flattened (`AdminSidebar` + `AdminViewSecure`), os botões de ação "Sync PipeRun" e "Atualizar Dados" que ficavam no header do `SmartOpsTab` foram perdidos. Além disso, nunca existiu um botão para `piperun-full-sync`.

## Correção

### Arquivo: `src/pages/AdminViewSecure.tsx`

Adicionar uma barra de ações no topo da área de conteúdo quando qualquer seção Smart Ops (`so-*`) estiver ativa:

- **Botão "Sync Incremental"** — invoca `smart-ops-sync-piperun` (sync rápido dos deals recentes)
- **Botão "Full Sync PipeRun"** — invoca `piperun-full-sync` (sync completo de todos os pipelines)
- **Botão "Atualizar Dados"** — incrementa `refreshKey` para recarregar o componente ativo
- Badge "Webhook ativo" para contexto visual

A barra aparece apenas quando `activeSection.startsWith('so-')`.

```text
┌──────────────────────────────────────────────────┐
│ Smart Ops    [Webhook ativo]                     │
│                    [Sync Incremental] [Full Sync] [↻ Atualizar] │
├──────────────────────────────────────────────────┤
│ (componente atual: Bowtie, Kanban, etc.)         │
└──────────────────────────────────────────────────┘
```

### Detalhes Técnicos

1. Criar dois handlers async no `AdminViewSecure`:
   - `handleSyncIncremental` → `supabase.functions.invoke("smart-ops-sync-piperun")`
   - `handleFullSync` → `supabase.functions.invoke("piperun-full-sync")`
2. Estados `syncingIncremental` e `syncingFull` para disable dos botões
3. Após sucesso de qualquer sync, incrementar `refreshKey`
4. A barra fica dentro do `<main>`, antes do `renderContent()`

## Arquivo Afetado

- `src/pages/AdminViewSecure.tsx`

