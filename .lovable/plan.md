## Objetivo

Adicionar um botão na seção "Pré-visualização do fluxo" do editor (`SmartOpsSdrCaptacaoEditor`) que abre o fluxograma numa **nova janela/aba** (arrastável para outro monitor) e que se **atualiza automaticamente** conforme você modifica o formulário no editor original.

---

## Como vai funcionar (visão do usuário)

1. Na seção "E. Pré-visualização do fluxo", aparece um botão **"Abrir em nova janela ↗"** ao lado do título.
2. Clicando, abre `/admin/form-flow/<formId>` numa janela nova (sem header/sidebar do admin, ocupando 100% da tela — ideal para arrastar para outro monitor).
3. Você volta para o editor, edita perguntas / opções / regras condicionais e clica em **Salvar**.
4. A janela do fluxo detecta a mudança e re-renderiza o diagrama em ~1 segundo, sem precisar dar refresh.

---

## Arquitetura técnica

### 1. Nova rota standalone
- Adicionar rota `/admin/form-flow/:formId` em `src/App.tsx` apontando para uma nova página `src/pages/SmartOpsFormFlowStandalone.tsx`.
- A página renderiza apenas:
  - Cabeçalho mínimo com nome do formulário + badge "🔴 ao vivo".
  - `<SmartOpsFormFlowPreview formId={formId} />` ocupando `100vh`.
- Sem `AdminSidebar`, sem `Header` — janela limpa para uso em monitor secundário.

### 2. Botão no editor
- Em `SmartOpsSdrCaptacaoEditor.tsx`, ao lado de "Pré-visualização do fluxo":
  ```tsx
  <Button variant="outline" size="sm" onClick={() => 
    window.open(`/admin/form-flow/${form.id}`, `flow-${form.id}`,
      'width=1400,height=900,menubar=no,toolbar=no')
  }>
    <ExternalLink className="w-4 h-4 mr-1" /> Abrir em nova janela
  </Button>
  ```
- O nome `flow-${form.id}` faz com que clicar de novo reutilize a janela existente (não abre múltiplas).

### 3. Atualização em tempo real (2 camadas, redundantes)

**Camada A — Supabase Realtime (fonte da verdade):**
- Em `SmartOpsFormFlowPreview.tsx`, inscrever no canal Postgres changes da tabela `smartops_form_fields`, filtrado por `form_id=eq.${formId}`.
- Em qualquer `INSERT`/`UPDATE`/`DELETE`, refazer o `select` e reconstruir o grafo.
- Requer que a tabela esteja com `REPLICA IDENTITY FULL` e adicionada à publicação `supabase_realtime`. Se ainda não estiver, criar migration:
  ```sql
  ALTER TABLE smartops_form_fields REPLICA IDENTITY FULL;
  ALTER PUBLICATION supabase_realtime ADD TABLE smartops_form_fields;
  ```
  (idempotente — checar antes via `pg_publication_tables`).

**Camada B — BroadcastChannel (latência zero entre abas do mesmo navegador):**
- Após cada save bem-sucedido no editor (`SmartOpsFormEditor` / `SmartOpsMappingFieldsEditor`), emitir:
  ```ts
  new BroadcastChannel(`smartops-form-${formId}`).postMessage({ type: 'fields-updated' });
  ```
- A janela do fluxo escuta esse canal e dispara um refetch imediato (mesmo antes do realtime do Postgres chegar).

Combinando as duas: instantâneo na mesma máquina (BroadcastChannel) + funciona entre máquinas diferentes (Supabase Realtime).

### 4. Indicador visual de "ao vivo"
- Pequeno badge pulsante verde no canto da janela standalone: "● Conectado · atualiza ao salvar".
- Se a inscrição realtime falhar, troca para amarelo: "● Polling a cada 5s" (fallback com `setInterval`).

---

## Arquivos a alterar/criar

| Arquivo | Ação |
|---|---|
| `src/pages/SmartOpsFormFlowStandalone.tsx` | **Criar** — página fullscreen |
| `src/App.tsx` | Adicionar rota `/admin/form-flow/:formId` |
| `src/components/SmartOpsSdrCaptacaoEditor.tsx` | Adicionar botão "Abrir em nova janela" |
| `src/components/SmartOpsFormFlowPreview.tsx` | Adicionar realtime subscription + BroadcastChannel listener |
| `src/components/SmartOpsFormEditor.tsx` | Emitir BroadcastChannel após save |
| `src/components/SmartOpsMappingFieldsEditor.tsx` | Emitir BroadcastChannel após save |
| Migration nova | `ALTER PUBLICATION supabase_realtime ADD TABLE smartops_form_fields` (se necessário) |

---

## Decisões a confirmar

1. **Acesso à rota standalone**: ela deve exigir login (mesmo guard que `/admin`) ou pode ser pública por `formId` (mais fácil de abrir em outro monitor sem relogar)? Recomendo **exigir login** — mesmo guard do admin.
2. **Realtime entre máquinas diferentes**: vale a pena habilitar Supabase Realtime na tabela (migration), ou só atualização entre abas do mesmo navegador (BroadcastChannel) já basta para seu caso de uso?
