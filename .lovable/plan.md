## Problema

Após o cadastro espelhado de resinas, alguns cards no `/base-conhecimento?tab=catalogo` perderam FDS/IFU e o contador "📑 Documentos (N)". Investigação confirma:

- Banco intacto: `resin_documents`, `catalog_documents` e os CTAs em `system_a_catalog` estão preservados.
- Causa real: o componente `src/components/knowledge/KbTabCatalogo.tsx` faz o join catálogo→resin via chave fuzzy `resinKey()` (tokens ordenados, sem stopwords). Para 2 produtos os tokens divergem entre os dois lados e o join falha.

## Casos quebrados

| Card | Resin DB | Motivo |
|---|---|---|
| "Resina 3D Smart Print Bio Denture" | "Smart Print Bio Denture (Rosa)" | token extra `rosa` |
| "Resina Smart Print Modelo Láqua" | "Smart Print Model L'Aqua" | `l'aqua` vira tokens `l` + `aqua` |

## Correção (somente frontend, zero migração)

Endurecer `resinKey()` + `lookup` em `src/components/knowledge/KbTabCatalogo.tsx`:

1. **resinKey**: remover tokens de 1 letra (descarta o `l` órfão de `l'aqua`) e expandir stopwords com cores/qualificadores comuns entre parênteses: `rosa`, `branca`, `branco`, `clear`, `translucida`, `translucido`, `transparente`. Isso só afeta o **matching** — não muda o que é exibido.

2. **Lookup com fallback subset**: quando `resins.get('fk:'+keyCatalogo)` não bate exato, varrer o map e aceitar match quando o conjunto de tokens de um lado for subconjunto do outro (≥2 tokens em comum). Isso cobre futuras divergências sem precisar editar dados.

## O que NÃO mudará

- Nenhuma alteração em `resins`, `resin_documents`, `catalog_documents`, `system_a_catalog`.
- Caminhos de documentos (URLs Storage / document-proxy) preservados.
- Render dos cards (cores, ordem, badges) idêntico — só o join volta a casar.

## Validação

Após o patch, conferir no preview `/base-conhecimento?tab=catalogo` que "Bio Denture" e "Modelo Láqua" voltem a exibir 📄 FDS, 📘 IFU e 📑 Documentos quando aplicável.
