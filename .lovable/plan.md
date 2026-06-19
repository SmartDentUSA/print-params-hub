## Objetivo
Alterar a exibição dos grupos de WhatsApp na Central de Campanhas (aba "Grupos WA") do formato de **cards em grid** para **lista de 1 item por linha**, mantendo todas as informações visíveis hoje no card.

## Escopo
- **Arquivo:** `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx`
- **Apenas frontend** — nenhuma alteração de lógica, API, banco ou edge functions.

## Alterações planejadas

### 1. Container de listagem (linhas 560–714)
- Substituir `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">` por `<div className="space-y-3">`.
- Cada item continuará usando `<Card>`, mas com layout horizontal/linha em vez de vertical/card.

### 2. Estrutura interna do item (linha por linha)
Cada linha será organizada em zonas para manter **todas** as informações existentes:
- **Coluna 1 — Identificação:** checkbox (modo seleção), nome do grupo (sem line-clamp), badge Admin/Não-admin.
- **Coluna 2 — Métricas:** contagem de membros, toggle ativado/desativado.
- **Coluna 3 — Campanha (se houver):** status, nome, badge "compartilhada", progresso barra + percentual, estatísticas (enviadas/pendentes/falhas), próximo envio, health badge compacto, session badge.
- **Coluna 4 — Ações:** botões Criar/Editar régua, Visualizar, Pausar/Retomar (todos os botões atuais preservados).
- **Estado sem campanha:** exibir "Sem campanha ativa" com botão de criar régua.
- **Dimming/destaque:** manter `opacity-50` para desativados e `ring-2 ring-primary` para selecionados.

### 3. Skeleton de loading (linhas 550–553)
- Adaptar o skeleton do grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) para o formato lista (`space-y-3` com 3 `<Skeleton className="h-24 rounded-lg" />`).

### 4. Réguas compartilhadas (linhas 466–547)
- Manter como está (já é um formato lista vertical dentro de um Card). Apenas garantir consistência visual se necessário.

## O que NÃO muda
- Lógica de: busca, filtros (ativados/desativados), seleção múltipla, botão de blast, sincronização, pausar/retomar campanhas, toggle enabled.
- Todos os badges, ícones, tooltips, session badges e health badges existentes.
- Nenhuma chamada a Supabase, edge function ou API.

## Validação
Após implementação, a tela de Grupos WA deve exibir cada grupo em uma linha única, com todas as informações anteriores visíveis (nome, membros, toggle, status da campanha, progresso, estatísticas de mensagens, próximo envio, badges e botões de ação).