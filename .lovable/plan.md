

## Plano: Traduzir Labels do Autor para Todos os Idiomas

### Problema

Os textos da seção "Sobre o autor" estão hardcoded em português em 3 arquivos:

| Texto hardcoded | Onde aparece |
|---|---|
| "Sobre o autor" | `AuthorSignature.tsx` (linha 50), `authorSignatureHTML.ts` (linha 73) |
| "Mini Currículo" | `AuthorSignature.tsx` (linha 86), `authorSignatureHTML.ts` (linha 51) |
| "Ver Currículo Lattes" | `AuthorSignature.tsx` (linha 98), `AuthorBio.tsx` (linha 80), `authorSignatureHTML.ts` (linha 60) |

Quando o usuario troca para EN ou ES, esses textos permanecem em PT porque nao usam o sistema de traducao `t()`.

### Solucao

#### 1. Adicionar chaves de traducao nos 3 arquivos de locale

**`src/locales/pt.json`** - Adicionar dentro de `"knowledge"`:
```json
"about_author": "Sobre o autor",
"mini_cv": "Mini Currículo",
"view_lattes": "Ver Currículo Lattes"
```

**`src/locales/en.json`** - Adicionar dentro de `"knowledge"`:
```json
"about_author": "About the author",
"mini_cv": "Short Bio",
"view_lattes": "View Lattes CV"
```

**`src/locales/es.json`** - Adicionar dentro de `"knowledge"`:
```json
"about_author": "Sobre el autor",
"mini_cv": "Mini Currículum",
"view_lattes": "Ver Currículum Lattes"
```

#### 2. `src/components/AuthorSignature.tsx`

- Importar `useLanguage` do contexto
- Substituir "Sobre o autor" (linha 50) por `{t('knowledge.about_author')}`
- Substituir "Mini Currículo" (linha 86) por `{t('knowledge.mini_cv')}`
- Substituir "Ver Currículo Lattes" (linha 98) por `{t('knowledge.view_lattes')}`

#### 3. `src/components/AuthorBio.tsx`

- Importar `useLanguage` do contexto
- Substituir "Ver Currículo Lattes" (linha 80) por `{t('knowledge.view_lattes')}`

#### 4. `src/utils/authorSignatureHTML.ts`

Este arquivo gera HTML como string (usado quando o token `[[ASSINATURA_AUTOR]]` aparece no conteudo). Nao tem acesso ao hook `useLanguage` por ser uma funcao utilitaria.

**Solucao:** Adicionar parametro `language` opcional a funcao `generateAuthorSignatureHTML` e usar um mapa simples de traducoes inline:
- Receber `language?: 'pt' | 'en' | 'es'` como segundo parametro
- Criar mapa local com as 3 traducoes
- Substituir os textos hardcoded pelos valores do mapa

#### 5. `src/utils/authorSignatureToken.ts`

- Atualizar `renderAuthorSignaturePlaceholders` para aceitar e repassar o parametro `language` para `generateAuthorSignatureHTML`

#### 6. `src/components/KnowledgeContentViewer.tsx`

- Passar `language` ao chamar `renderAuthorSignaturePlaceholders` (linha ~230) para que o HTML inline tambem seja traduzido

### Arquivos a Modificar

| Arquivo | Acao |
|---|---|
| `src/locales/pt.json` | Adicionar 3 chaves |
| `src/locales/en.json` | Adicionar 3 chaves |
| `src/locales/es.json` | Adicionar 3 chaves |
| `src/components/AuthorSignature.tsx` | Usar `t()` nos 3 textos |
| `src/components/AuthorBio.tsx` | Usar `t()` em 1 texto |
| `src/utils/authorSignatureHTML.ts` | Adicionar parametro `language` e mapa de traducoes |
| `src/utils/authorSignatureToken.ts` | Repassar `language` |
| `src/components/KnowledgeContentViewer.tsx` | Passar `language` na chamada |

### Resultado Esperado

- "Sobre o autor" -> "About the author" (EN) / "Sobre el autor" (ES)
- "Mini Currículo" -> "Short Bio" (EN) / "Mini Currículum" (ES)
- "Ver Currículo Lattes" -> "View Lattes CV" (EN) / "Ver Currículum Lattes" (ES)
- Funciona tanto no componente React quanto no HTML inline gerado pelo token `[[ASSINATURA_AUTOR]]`
