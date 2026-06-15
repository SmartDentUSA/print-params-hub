## Mudanças no Header de Abas (Base de Conhecimento)

### 1. Reordenar abas
Trocar a ordem atual `parametros → videos → artigos → catalogo` para:

`parametros → catalogo → videos → artigos → distribuidores`

Arquivo: `src/components/knowledge/KbTabSwitcher.tsx`
- Adicionar `'distribuidores'` ao tipo `KbTab`.
- Atualizar `ORDER` para a nova sequência.
- Adicionar ícone (loja/prédio) para `distribuidores`.

Arquivo: `src/pages/KnowledgeBase.tsx`
- Incluir `'distribuidores'` na lista de tabs válidas em `getInitialTab`.
- Renderizar `<KbTabDistribuidores />` quando `tab === 'distribuidores'`.

Arquivos de tradução (`src/locales/pt.json`, `es.json`, `en.json`):
- Adicionar `kb.tabs.distribuidores` (PT: "Distribuidores", EN: "Distributors", ES: "Distribuidores").

### 2. Nova aba "Distribuidores"
Novo arquivo: `src/components/knowledge/KbTabDistribuidores.tsx`

Lista somente leitura dos distribuidores cadastrados (tabela `distributors`, somente `active = true`), no mesmo estilo visual dos cards do catálogo:

- Query via `supabase.from('distributors').select(...).eq('active', true).order('nome_fantasia')`.
- Grid responsivo de cards exibindo:
  - Logo (`logo_url`) ou placeholder com a inicial.
  - Nome fantasia (título) + razão social (subtítulo).
  - Localização: `cidade / estado — pais`.
  - Linha "Unidades: N" quando `numero_unidades` existir.
  - Linha do proprietário: `owner_name` + WhatsApp clicável (`https://wa.me/{ddi}{whatsapp}`) + email (`mailto:`).
  - Linha do comprador (mesmo padrão), se preenchido.
  - Ícones de redes sociais (site, instagram, facebook, linkedin, youtube) só quando a URL existir.
- Busca por texto (filtra `nome_fantasia`, `razao_social`, `cidade`, `estado`).
- Estado vazio: "Nenhum distribuidor cadastrado".
- Sem edição/ativação aqui — gestão continua em Configurações.

### Fora de escopo
- Não mexer em RLS de `distributors` (já existe policy adequada).
- Não alterar a tela de administração de distribuidores.
- Não alterar o conteúdo da aba Catálogo.
