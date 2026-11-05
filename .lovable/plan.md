# Cada cadastro Meta conta como conversão nova

## Objetivo
Todo novo cadastro de um lead em formulário Meta (mesma campanha repetida, 2ª, 3ª campanha...) passa a contar como conversão nova. Se o deal aberto em Vendas estiver em Sem contato, C1, C2, C3 ou SDR/Nutrição, aplica a regra já criada:
- deal antigo vai para Estagnados (etapa "Leads que converteram em campanhas mesmo estando no funil comercial"), perdido com motivo "Converteu em outra campanha";
- novo deal em Vendas com origem atualizada e vendedor ativo sorteado;
- alerta ao vendedor anterior e registro na timeline.

## O que continua protegido
- Etapas avançadas de Vendas, deals ganhos e funis de CS: intocados.
- Única exceção ignorada: a Meta/Zernio reenviar tecnicamente **o mesmo envio** (mesmo ID de cadastro da Meta). Isso não é o lead convertendo de novo, é a mesma ficha chegando duas vezes; contar geraria deals duplicados e perderia o vendedor sem motivo.

## Mudanças
1. No recebimento de leads, o caminho de "reenvio" que hoje só enriquece a ficha quando o lead está em Vendas passa a gerar conversão nova sempre que o ID do cadastro Meta for diferente dos já recebidos para aquele lead (hoje isso só acontece para leads em Estagnados).
2. Chave de conversão Meta = ID do cadastro Meta; a trava já existente de "chave já consumida" impede processar o mesmo envio duas vezes.
3. Sem ID do cadastro (raro), usar formulário + data/hora de criação real enviada pela Meta, nunca horário do sistema.
4. Testes: novo cadastro na mesma campanha → conversão nova; outra campanha → conversão nova; mesmo ID repetido → ignorado; lead em C3 → troca de vendedor; lead em etapa avançada/ganho/CS → intocado.
5. Atualizar a regra documentada (AGENTS.md e documento do sistema) removendo "reenvio Meta não conta".

## Detalhes técnicos
- `smart-ops-ingest-lead`: no bloco de redelivery diferida (HARD/FAMILY_DEDUPE_DEFERRED), comparar `dedupeId` (meta_leadgen_id) com os leadgen já registrados do lead; se novo, invocar `smart-ops-lia-assign` com `new_conversion_confirmed: true` e `conversion_key: meta:leadgen:<id>` também para pipeline Vendas (não só 72938). Mesmo leadgen → mantém CDP-only.
- `golden-rule-guard.ts` / lia-assign: sem mudança de regra de etapas; apenas aceitar a nova origem da chave. Lock de criação de deal e `conversion_key` consumida continuam fail-closed.
- Deploy das duas funções e verificação com log de um caso real.
