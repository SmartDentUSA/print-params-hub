

# Plano: Criar e Executar `index-spin-entries`

## O que sera feito

Criar uma edge function temporaria que indexa as 5 entradas SPIN ja salvas em `company_kb_texts`, gerando os embeddings vetoriais necessarios para a L.I.A. encontra-las.

## Passos

### 1. Criar `supabase/functions/index-spin-entries/index.ts`

Funcao GET simples que:
- Busca em `company_kb_texts` onde `source_label = 'apostila-spin-competitive-edge'` e `indexed_at IS NULL`
- Para cada entrada: divide o texto em chunks de 900 chars com 150 de overlap
- Gera embedding Gemini (768 dims) para cada chunk
- Insere em `agent_embeddings` com source_type `company_kb`
- Atualiza `chunks_count` e `indexed_at` na entrada original
- Rate limit de 2s entre chamadas de embedding para evitar throttling

### 2. Atualizar `supabase/config.toml`

Adicionar:
```text
[functions.index-spin-entries]
verify_jwt = false
```

### 3. Deploy e execucao

- Fazer deploy da funcao
- Chamar via GET para disparar a indexacao
- Verificar no banco que as 5 entradas agora tem `chunks_count > 0` e `indexed_at` preenchido

### Resultado esperado

- ~15-25 chunks vetoriais criados em `agent_embeddings`
- L.I.A. passa a encontrar dados SPIN (pitch, FAQs SDR, regras anti-alucinacao, depoimentos) via busca vetorial

