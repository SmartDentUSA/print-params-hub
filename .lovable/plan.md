## Problema

1. **Menu superior (top tabs)** em `KbShellLayout.tsx` usa labels hardcoded em PT (`'Parâmetros', 'Catálogo', 'Vídeos', 'Artigos', 'Ebooks', 'Revendas', 'Eventos'`) e `aria-label="Abrir menu"` fixo — não passa por `t()`.
2. **Hero** usa `t('kb.hero.<tab>.title/subtitle')` corretamente, mas o override do Editor HUB (`site_settings.kb_hero_*`) sobrescreve incondicionalmente com o texto salvo (em PT). Como o admin salva um único valor, ele "vence" em qualquer idioma e faz o Hero parecer não traduzido.

## Correções

### 1. `src/components/knowledge/shell/KbShellLayout.tsx`
- Importar `useLanguage`.
- Trocar labels hardcoded de `TOP_TABS` por `t('kb.tabs.<key>')` (chaves já existem em `pt/en/es.json` sob `kb.tabs`; `distribuidores` também já tem tradução — usar essa em vez de "Revendas").
- Trocar `aria-label="Abrir menu"` por `t('kb.shell.open_menu')` (já existe nos 3 locales).
- Trocar `"Admin"` do botão por `t('common.admin')`.

### 2. `src/pages/KnowledgeBase.tsx` (bloco Hero, ~linhas 224–231)
Ajustar a lógica de override para não engolir a tradução quando o idioma ativo é EN/ES:

```ts
const isDefaultLang = language === 'pt';
const heroTitle    = (isDefaultLang && override.title)    ? override.title    : hero.title;
const heroSubtitle = (isDefaultLang && override.subtitle) ? override.subtitle : hero.subtitle;
const heroArt      = override.image_url || heroPrinterImg; // imagem continua global
```

Assim o override do Editor HUB (texto em PT) só se aplica em PT; EN/ES caem no `t('kb.hero.*')`. A imagem do Hero continua sendo compartilhada entre idiomas.

## Fora de escopo
- Não mexer no Editor HUB nem em `site_settings` (não há pedido para overrides por idioma).
- Nenhuma mudança em outros componentes/tabs.

## Verificação
- Alternar idioma para EN/ES em `/en/knowledge-base` e `/es/base-conocimiento` e conferir que menu superior + Hero trocam de idioma; PT com override configurado continua exibindo o texto customizado.