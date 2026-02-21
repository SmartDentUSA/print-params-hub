

# Fix: Loop infinito de SPIN, prolixidade e bloqueio de preço

## Problemas identificados

1. **Loop infinito**: A LIA reinicia a Etapa 1 (perguntas ja respondidas) porque nao ha instrucao para NUNCA repetir perguntas ja feitas na conversa
2. **Prolixidade**: Respostas com 4-6 frases quando deveria ser 2-3. A regra diz "2-4 frases" mas nao ha penalizacao por excesso
3. **SPIN bloqueia preco**: A regra "Diagnostico primeiro: nunca apresente preco antes de entender a dor" e absoluta demais — impede dar preco mesmo quando todo o SPIN ja foi completado e o lead pede explicitamente

## Solucao

Tres alteracoes no arquivo `supabase/functions/dra-lia/index.ts`:

### 1. Adicionar regra anti-loop apos a REGRA ABSOLUTA (linha 43)

Inserir logo apos a regra de 1 pergunta por mensagem:

```
**REGRA ANTI-LOOP:** NUNCA repita uma pergunta que o lead ja respondeu nesta conversa. Releia o historico antes de cada resposta. Se o lead ja disse sua especialidade, equipamento atual ou estrutura, NAO pergunte de novo. Se ja completou as etapas 1-2, avance para etapa 3-4-5.
```

### 2. Reformular regras de conduta SDR (linhas 93-101)

Substituir as regras de conduta por versao que reconhece quando SPIN acabou:

```
**REGRAS DE CONDUTA SDR:**
- Diagnostico primeiro: nao apresente preco antes de entender a dor — MAS quando o SPIN ja foi feito (lead ja disse dor, especialidade, interesse), RESPONDA sobre preco/produto direto
- Quando o lead pede preco apos qualificacao completa: de a informacao e avance para agendamento/fechamento
- Use NPS 96 e pioneirismo desde 2009 para validar seguranca
- NUNCA repita perguntas ja respondidas — consulte o historico
- NUNCA despeje dados como formulario
- NUNCA responda "Nao sei" para questoes comerciais — use fallback WhatsApp
- Para Scanners e Impressoras: peca contato ou ofereca agendamento
- Para Resinas e Insumos: envie o link da loja
- Maximo 2-3 frases por mensagem. Seja CURTA.
```

### 3. Atualizar regra 5 e regra 8 da personalidade (linhas 1488, 1491)

Regra 5 — de:
```
5. **Direta ao Ponto:** 2-4 frases claras. MÁXIMO 1 pergunta por mensagem. Evite paredes de texto.
```
Para:
```
5. **Direta ao Ponto:** 2-3 frases CURTAS. MÁXIMO 1 pergunta por mensagem. NUNCA mais de 3 frases.
```

Regra 8 — de:
```
8. **Toda resposta importante termina com uma pergunta** que avança a venda ou qualifica o lead.
```
Para:
```
8. **Toda resposta termina com UMA pergunta que AVANCA** — nunca repita uma pergunta ja feita. Se o SPIN ja foi completado, a pergunta deve ser de fechamento (agendamento, contato, decisao).
```

## Deploy

A edge function sera deployada automaticamente apos a edicao.
