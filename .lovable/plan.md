## Objetivo

Permitir que representantes cadastrem novos distribuidores via URL pública (sem login), com os mesmos campos do modal interno de Smart Ops → Distribuição. Cadastro entra direto aprovado (`active = true`).

## Arquitetura

```
Rep abre /cadastro-distribuidor
        │
        ▼
PublicDistributorRegister.tsx (mesmo form do modal, sem botão Editar/Excluir)
        │ POST { payload, logoBase64? }
        ▼
edge function public-distributor-register  ◄── service_role (bypass RLS)
        │ 1) valida payload com zod
        │ 2) upload do logo no bucket distributor-logos (se houver)
        │ 3) insert em public.distributors com active = true
        │ 4) rate-limit por IP (smart_form_rate_limit, 5 req / hora)
        ▼
Sucesso → tela "Distribuidor cadastrado ✅" + opção "Cadastrar outro"
```

Por que edge function em vez de insert direto do anon: a tabela `distributors` tem RLS ativa e os logos são enviados para um bucket de Storage que não deve aceitar upload anônimo livre. A função usa `SUPABASE_SERVICE_ROLE_KEY` para escrever, mas valida tudo server-side e impõe rate-limit.

## Mudanças

### 1. Novo componente `src/pages/PublicDistributorRegister.tsx`
- Reaproveita a UI do `SmartOpsDistributors` (todas as seções: Identificação, Localização, Presença Digital, Contato Proprietário, Contato Compras, Observações, Autorização Comercial).
- Extrair as seções de formulário do `SmartOpsDistributors.tsx` para um componente compartilhado `DistributorForm.tsx` (mesmo `Partial<Distributor>` + `onChange`) — evita duplicar 280 linhas de JSX.
- Layout standalone: header com logo SmartDent + título "Cadastro de Distribuidor Credenciado", sem sidebar/admin chrome.
- Submit envia `supabase.functions.invoke('public-distributor-register', { body: { payload, logoBase64 } })`.
- Após sucesso: tela de confirmação + botão "Cadastrar outro".

### 2. Refator `src/components/smartops/SmartOpsDistributors.tsx`
- Mover o `<Dialog>` interno para usar `<DistributorForm>` — sem mudança de UX no painel interno.
- Adicionar botão **"Copiar link público"** ao lado do botão "Novo Distribuidor", que copia `https://admin.smartdent.com.br/cadastro-distribuidor` para o clipboard com toast.

### 3. Novo componente `src/components/smartops/DistributorForm.tsx`
- Recebe `value: Partial<Distributor>`, `onChange`, `onLogoUpload` (opcional — no modo público, upload acontece junto com submit final).
- Mesmas 6 seções; lógica de país/estado/cidade e autorização comercial idênticas.

### 4. Rota em `src/App.tsx`
- `<Route path="/cadastro-distribuidor" element={<PublicDistributorRegister />} />`
- Sem proteção de auth.

### 5. Nova edge function `supabase/functions/public-distributor-register/index.ts`
- CORS aberto.
- `verify_jwt = false`.
- Valida com zod (razao_social obrigatório, emails válidos, scope é objeto, etc.).
- Rate-limit: 5 submissões / hora por IP (reusa tabela `smart_form_rate_limit`).
- Se `logoBase64` presente: decode → upload no bucket `distributor-logos` com `crypto.randomUUID()` → pega publicUrl.
- `insert` na tabela `distributors` via service role com `active: true`.
- Retorna `{ ok: true, id }` ou `{ error }`.

### 6. SEO da página pública
- `<title>` Cadastro de Distribuidor Credenciado | SmartDent (<60 chars)
- meta description, H1 único, viewport responsivo.
- `<meta name="robots" content="noindex">` (não queremos esse form aparecendo em busca pública — é só para reps com o link).

## Fora de escopo

- Sem token por rep, sem fila de aprovação, sem login (conforme suas respostas).
- Sem alterar RLS atual de `distributors` (admin continua usando o cliente autenticado pelo painel).
- Sem mudar nada em Knowledge Base / `/distribuidores` (página pública de listagem já existe).

## Validação

1. Build passa.
2. Abrir `/cadastro-distribuidor` em aba anônima → form renderiza completo.
3. Preencher razão social + alguns campos + logo → submeter → toast verde, registro aparece no painel interno como ativo.
4. Submit sem razão social → erro de validação client-side.
5. 6ª submissão da mesma IP em < 1h → 429.
6. Botão "Copiar link público" no painel interno copia a URL correta.