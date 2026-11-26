# Atendente de produto no WhatsApp API oficial (teste) + AUTO para toda a equipe

## Situação atual (verificada)
- O AUTO já é liberado para quem é membro ativo da equipe: o sistema reconhece o telefone pelo WhatsApp, telefone Evolution ou telefone de notificação. Hoje os 21 membros ativos têm telefone cadastrado.
- O 19 99261-2348 está cadastrado como membro da equipe, então hoje qualquer mensagem dele que não seja AUTO é ignorada pelo fluxo de captura.

## O que será feito

### 1. AUTO para todos os Team Members
- Revisar o reconhecimento para aceitar também telefones adicionais cadastrados na Equipe (mesma regra já usada no login por celular: DDD + últimos 8 dígitos, com ou sem 55/9º dígito).
- Entregar a lista dos 21 membros dizendo quem é reconhecido e por qual número, para corrigir cadastros que não batem.

### 2. Atendente de produto (somente teste no 19 99261-2348)
Gatilho: a mensagem começa com o nome de um produto do portfólio (ex.: "Vitality", "Exoplan", "Edge Mini"). AUTO e capturas abertas continuam com prioridade.

Fluxo:
1. Identifica o produto pelo catálogo (nome e apelidos já cadastrados). Sem produto reconhecido: responde pedindo o nome do produto, sem criar lead.
2. Responde dúvidas sobre o produto e conteúdos da base de conhecimento (mesmo motor da Dra. LIA, sem preços).
3. Envia o lead para o fluxo de novo lead com Regra de Ouro, origem `[SDRWHTAS] - Qualificação Automática`, produto de interesse = produto citado, conversa nas notas do PipeRun.
4. Retorna o cartão de contato do vendedor designado pela Regra de Ouro.
5. Envia o link do grupo de especialistas do produto (grupo vinculado à categoria do produto).
6. Perguntas seguintes na mesma conversa continuam sendo respondidas sem criar novo lead.

Restrição de teste: só o 19 99261-2348 aciona esse fluxo, mesmo sendo membro da equipe. Liberar para clientes fica para depois do teste.

## Pontos a confirmar durante a construção
- De onde vem o grupo de especialistas por produto: usar o grupo já vinculado aos formulários/landing do produto; se algum produto não tiver, ele é listado e o envio do grupo é pulado.

## Detalhes técnicos
- Novo módulo em `wa-field-capture` (ou função `wa-product-agent` chamada pelo mesmo gatilho da inbox Zernio), com allowlist do telefone de teste em constante.
- Detecção de produto por `system_a_catalog` + `produto_aliases` (`painel_nome_norm`), respostas via RAG existente da `dra-lia`.
- Ingestão por `smart-ops-ingest-lead` (Regra de Ouro, lock de criação de negócio, nota unificada); vendedor lido do resultado do assign; cartão de contato com `sendContactCard` existente.
- `fn_team_member_by_phone` ganha os telefones extras de `_shared/team-phone-match.ts`, mantendo regra única.
- Testes: detecção de produto, allowlist, prioridade AUTO, não duplicar lead na mesma conversa.
