

## Plano: Traduzir Artigos Automaticamente ao Trocar Idioma

### Objetivo
Quando o usuario seleciona EN ou ES, os artigos que ainda nao possuem traducao serao traduzidos automaticamente em tempo real usando a edge function `translate-content`, salvando o resultado no banco para futuras visitas.

### Fluxo

```text
1. Usuario seleciona idioma EN/ES
2. KnowledgeContentViewer verifica se artigo tem traducao
3a. SE TEM traducao -> exibe normalmente (ja funciona)
3b. SE NAO TEM -> chama translate-content automaticamente
4. Enquanto traduz: exibe spinner "Traduzindo..."
5. Traducao concluida: salva no banco + exibe conteudo traduzido
6. Proxima visita ao mesmo artigo: usa traducao ja salva (sem chamar IA de novo)
```

### Mudancas

#### 1. `src/components/KnowledgeContentViewer.tsx`

- **Remover** o `useEffect` de redirect (linhas 58-65) que forca retorno ao PT
- **Adicionar** logica de traducao automatica:
  - Novo estado `translating: boolean` e `translatedContent: object | null`
  - Novo `useEffect` que, quando `hasTranslation === false` e `language !== 'pt'`:
    1. Seta `translating = true`
    2. Chama `supabase.functions.invoke('translate-content', { body: { title, excerpt, htmlContent, faqs, targetLanguage } })`
    3. Salva resultado no banco (`knowledge_contents` com `title_en/es`, `excerpt_en/es`, `content_html_en/es`, `faqs_en/es`)
    4. Atualiza `translatedContent` com os dados traduzidos
    5. Seta `translating = false`
  - O `displayContent` passa a considerar `translatedContent` como fonte adicional
  - Exibe um indicador de carregamento ("Traduzindo conteudo...") enquanto a traducao esta em andamento

#### Nenhum outro arquivo precisa ser alterado

A edge function `translate-content` ja existe e funciona corretamente. A unica mudanca e no componente que exibe o artigo.

### Resultado Esperado
- Trocar idioma nunca mais redireciona de volta para PT
- Artigos sem traducao sao traduzidos automaticamente na primeira visita
- Traducao e salva no banco, entao so acontece uma vez por artigo/idioma
- Artigos ja traduzidos carregam instantaneamente

