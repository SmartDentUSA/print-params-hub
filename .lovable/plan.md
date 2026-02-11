

## Video Premium Gate - Popup apos 5 minutos

### Resumo

Ao assistir um video marcado como "premium" por mais de 5 minutos, o video sera coberto por um overlay e um popup modal aparecera direcionando o usuario para a area de membros da sua plataforma de cursos. A URL da area de membros sera configuravel no painel admin.

### Alteracoes necessarias

#### 1. Banco de dados (2 migrations)

**Migration 1 - Coluna `is_premium` na tabela `knowledge_videos`:**
- Adicionar coluna `is_premium BOOLEAN DEFAULT false` na tabela `knowledge_videos`
- Videos existentes serao `false` por padrao

**Migration 2 - Configuracao `members_area_url` na tabela `site_settings`:**
- Inserir registro com `key = 'members_area_url'` e `value = ''` (vazio inicialmente)

---

#### 2. Componente `VideoGateOverlay` (novo arquivo)

**Arquivo:** `src/components/VideoGateOverlay.tsx`

- Componente que renderiza um overlay escuro sobre o iframe do video + modal centralizado
- Conteudo do modal:
  - Icone de cadeado
  - Titulo: "Conteudo Exclusivo para Membros"
  - Texto: "Continue assistindo na area de membros"
  - Botao CTA: "Acessar Area de Membros" (abre a URL configurada em nova aba)
  - Botao secundario: "Fechar" (fecha o overlay mas nao retoma o video)
- Estilo: overlay `absolute inset-0` com `backdrop-blur` + `z-50`

---

#### 3. Componente `KnowledgeContentViewer.tsx` (modificar)

**Logica do timer:**
- Para cada video com `is_premium === true`, iniciar um `setInterval` de 1 segundo quando o iframe renderizar
- Ao atingir 300 segundos (5 minutos), setar um estado `gatedVideoId` com o ID do video
- Renderizar o `VideoGateOverlay` sobre o container do video gated

**Fetch da URL:**
- No `useEffect` de carregamento, buscar `site_settings` com `key = 'members_area_url'` e armazenar no estado
- Passar a URL para o `VideoGateOverlay`

**Estrutura do container do video:**
- Envolver cada video premium em um `div` com `position: relative` para que o overlay funcione corretamente

---

#### 4. Admin - Checkbox "Premium" nos videos

**Arquivo:** `src/components/AdminVideosList.tsx`

- Adicionar coluna "Premium" na tabela de videos com um `Switch` toggle
- Ao alternar, fazer `UPDATE knowledge_videos SET is_premium = !current WHERE id = ...`
- Exibir badge "Premium" ao lado do titulo dos videos marcados

---

#### 5. Admin - Campo "URL Area de Membros" nas configuracoes

**Arquivo:** `src/components/AdminSettings.tsx`

- Adicionar campo de texto na aba de configuracoes gerais
- Label: "URL da Area de Membros"
- Placeholder: "https://suaplataforma.com/membros"
- Salvar usando o hook `updateSiteSetting('members_area_url', value)` ja existente em `useSupabaseData`

---

### Detalhes tecnicos

**Por que timer e nao API do player?**
Os videos sao embedados via iframe (YouTube e PandaVideo). Controlar o player via API exigiria configuracao especifica para cada provedor e nem sempre e possivel com iframes de terceiros. O timer universal e mais simples e funciona com qualquer provedor.

**Limitacao conhecida:**
O timer conta tempo de exibicao do iframe, nao tempo real de reproducao. Se o usuario pausar o video, o timer continua. Isso e aceitavel pois a intencao e ser uma "isca" - nao precisa ser precisao exata.

**Fluxo do usuario:**

```text
[Usuario abre artigo com video premium]
        |
        v
[Video comeca a tocar normalmente]
        |
        v  (5 minutos de timer)
[Overlay escuro cobre o video]
[Modal aparece com CTA]
        |
    /       \
   v         v
[Clica CTA]  [Fecha modal]
   |              |
   v              v
[Abre area     [Overlay some,
 de membros     video continua
 em nova aba]   coberto/pausado]
```

