

# Corrigir 2 bugs no banco e re-executar archive-daily-chats

## Problema

A tabela `company_kb_texts` tem 2 problemas que impedem o arquivamento:

1. **CHECK constraint muito restritivo** -- so aceita `sdr, comercial, workflow, suporte, faq, objecoes, onboarding, geral`. Faltam `leads, clientes, campanhas, pos_venda` que o archiver gera.
2. **Falta UNIQUE(title, source_label)** -- o `upsert` do `ingest-knowledge-text` usa `onConflict: "title,source_label"` mas nao existe essa constraint, causando erro.

## Alteracoes

### 1. Migracao SQL (2 comandos)

```text
-- Remover CHECK antigo e adicionar com todas as categorias
ALTER TABLE company_kb_texts DROP CONSTRAINT company_kb_texts_category_check;

ALTER TABLE company_kb_texts ADD CONSTRAINT company_kb_texts_category_check
  CHECK (category = ANY (ARRAY[
    'sdr', 'comercial', 'workflow', 'suporte', 'faq',
    'objecoes', 'onboarding', 'geral',
    'leads', 'clientes', 'campanhas', 'pos_venda'
  ]));

-- Adicionar constraint UNIQUE para o upsert funcionar
ALTER TABLE company_kb_texts
  ADD CONSTRAINT company_kb_texts_title_source_label_key
  UNIQUE (title, source_label);
```

### 2. Re-executar archive-daily-chats

Apos a migracao, invocar a edge function com `{ "days_back": 30 }` para processar as 64 conversas historicas.

### Resultado

As conversas serao salvas em `company_kb_texts` com `source_label = 'LIA-Dialogos'`, divididas por categoria (comercial, suporte, leads, etc.) e indexadas com embeddings em `agent_embeddings`.

