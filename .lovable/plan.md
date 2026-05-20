## Objetivo

Substituir a página embed atual (`/embed/treinamentos` no domínio Lovable) por uma rota pública oficial no domínio próprio:

**https://parametros.smartdent.com.br/agenda**

…com atualização em tempo real (sem precisar dar refresh) quando cursos/turmas forem criados, editados, ou tiverem novas inscrições.

---

## Mudanças

### 1. Nova rota pública `/agenda`
- Criar `src/pages/AgendaPublica.tsx` (renomeando/reutilizando a lógica de `EmbedTrainings.tsx`).
- Registrar no `src/App.tsx`: `<Route path="/agenda" element={<AgendaPublica />} />`.
- Esconder Header/Footer/Dra. LIA na rota (já é o padrão de `/embed`; estender o guard para `/agenda` também — ou render a página com layout próprio enxuto).
- Como o domínio `parametros.smartdent.com.br` já aponta para este projeto, a URL final fica automaticamente: `https://parametros.smartdent.com.br/agenda`.

### 2. Atualização em tempo real (Supabase Realtime)
- Habilitar replicação realtime nas tabelas:
  - `smartops_courses`
  - `smartops_course_turmas`
  - `smartops_turma_days`
- Na página `/agenda`, subscrever via `supabase.channel(...).on('postgres_changes', ...)` para essas 3 tabelas e invalidar o query do React Query a cada evento (INSERT/UPDATE/DELETE).
- Resultado: novo curso publicado, nova turma, nova inscrição → o card aparece/atualiza sem refresh em todos os visitantes.

### 3. Aba "Página Pública" no admin
Atualizar `PaginaPublicaTab` em `src/components/SmartOpsCourses.tsx`:
- **URL pública** passa a ser fixa: `https://parametros.smartdent.com.br/agenda`.
- **Código iframe simples**: aponta para essa URL.
- **Código iframe com auto-ajuste de altura**: mesma URL, com listener `postMessage` (já implementado).
- **HTML puro completo**: página standalone pronta para subir em qualquer servidor, embutindo o iframe da `/agenda`.
- Manter pré-visualização ao vivo apontando para `/agenda`.

### 4. Compatibilidade
- Manter `/embed/treinamentos` como alias (redirect 301 client-side para `/agenda`) para não quebrar quem já embutiu o snippet antigo.

---

## Pontos técnicos

- **Realtime**: requer `ALTER PUBLICATION supabase_realtime ADD TABLE …` + `REPLICA IDENTITY FULL` nas 3 tabelas. Será feito via migration.
- **RLS**: as tabelas já devem ter policy de SELECT pública para `active=true AND public_visible=true`. Validar antes de publicar; se faltar, adicionar policy `SELECT` para `anon`.
- **Auto-resize iframe**: o `postMessage` da página `/agenda` continua igual ao de `/embed/treinamentos` (tipo `smartdent:embed:treinamentos:height`), então o snippet copiado pelo cliente continua funcionando.
- **SEO**: `/agenda` recebe `<title>` "Agenda de Treinamentos | Smart Dent" e `meta description` — útil porque agora é uma URL pública oficial, não embed.

---

## Entregáveis

1. Migration habilitando realtime nas 3 tabelas + RLS pública de leitura (se faltar).
2. `src/pages/AgendaPublica.tsx` com subscription realtime.
3. Rota `/agenda` no `App.tsx` + guard de Header/Footer/DraLIA estendido.
4. Redirect de `/embed/treinamentos` → `/agenda`.
5. `PaginaPublicaTab` atualizada para usar a URL `https://parametros.smartdent.com.br/agenda` em todos os snippets.