---
name: smartdent-marketing
description: Marketing da Smart Dent — campanhas, descrição de produtos, estratégia, ICP, copy para redes sociais e prompts de imagem para ChatGPT/GPT-4.6 com formatos e margens de segurança. Use sempre que a tarefa envolver criar, revisar ou planejar qualquer peça de marketing, conteúdo comercial, caption, anúncio, landing, e-mail ou prompt de imagem da Smart Dent. Impõe consulta obrigatória às fontes internas (RAG v3, embeddings, catálogo, conteúdo publicado, Google Drive) antes de qualquer afirmação.
---

# SmartDent Marketing OS

Esta skill é um **ponteiro**. Todas as regras vivem em um único arquivo canônico,
para que Claude Chrome, Claude Code, Claude Chat/Projects e MCP operem sem discrepância.

## Ação obrigatória — antes de qualquer outra coisa

Leia integralmente:

```
docs/SKILL_SMARTDENT_MARKETING_OS.md
```

Não produza nenhuma peça de marketing antes de ler esse arquivo.
Não reproduza aqui as regras dele — elas mudam, e este arquivo não deve divergir.

## Resumo operacional (não substitui a leitura)

- **Regra Zero**: só afirme o que recuperou de fonte interna nomeável. Nunca invente
  número, norma, certificação, preço, depoimento, cliente ou compatibilidade.
- **Hierarquia de consulta**: RAG v3 → `agent_embeddings` → `smartdent_method_docs` →
  `system_a_catalog` → conteúdo publicado → social publicado → prova social/FAQ →
  Google Drive (só enriquecimento). Conhecimento geral do modelo: proibido.
- **Projeto Supabase (Sistema B)**: `okeogjgqijbfkudfjadz`.
- **Marca**: "Smart Dent" (com espaço). Paleta `#363E56` `#546085` `#8B9EB4` `#EDF0F7`
  + acento `#DE6E37`. Tipografia Host Grotesk.
- **Toda entrega** termina com o bloco `FONTES CONSULTADAS` + `LACUNAS`.
- **Lacuna encontrada** → declare, não improvise, e alimente o loop de memória (§7).

## Manutenção

Regra nova, formato novo ou restrição nova entram **em `docs/SKILL_SMARTDENT_MARKETING_OS.md`**,
com incremento de versão no cabeçalho. Nunca crie uma versão paralela desta skill.
