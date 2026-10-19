# Pipeline de credenciamento de profissionais (KOL) — ponta a ponta

## Objetivo
Transformar o fluxo profissional em um pipeline único: cadastro → contrato → aceite → formulário de indicação clonado → cupons → portal com QR codes — tudo acionável também pelo Copilot ("credencie o profissional X").

## Mudanças

### 1. Portal com login por nome + celular (sem token na URL)
- Nova rota pública `/portal-profissional` (e redirect de `/portal-cursos/:token` para compatibilidade com links já enviados).
- Login: profissional digita o celular; sistema localiza o lead KOL (`lia_attendances`, `merged_into IS NULL`, `is_kol`), cria sessão em `kol_access_sessions` (padrão já existente do Portal de Transparência KOL) e abre o portal.
- URL amigável por nome: `/portal-profissional/{prof_public_slug}` para compartilhamento, mas acesso sempre exige celular.
- A edge `professional-course-portal` passa a aceitar sessão de celular além do token legado (transição sem quebrar links antigos).

### 2. Aceite de contrato → formulário de indicação automático
- No aceite do contrato (edge `kol-portal`/`professional-course-portal`, server-side), criar automaticamente o formulário de indicação:
  - Clonar estrutura de `# - INDICAÇÃO - Erick Souza` (campos, opções, botões de produto, condições).
  - Nome: `# - INDICAÇÃO - {nome do profissional}`.
  - Vendedor responsável: o `seller_team_member_id` do contrato (o mesmo anotado no editor do profissional).
  - Vincular o novo formulário em `prof_kol_form_ids` da ficha.
- Idempotente: se já existir formulário de indicação vinculado, não duplica.

### 3. QR codes no portal
- Nova seção "Meus materiais" no portal: QR code do formulário de indicação e QR code da página de cupons, com botão de download (PNG) para o profissional usar em posts e consultório.

### 4. Pipeline único para o Copilot
- Nova edge function `kol-onboarding-pipeline` (staff-only, `fn_is_internal_staff`) com etapas ordenadas e relatório de cada passo:
  1. Criar/carregar ficha do profissional
  2. Aplicar padrão de comissão
  3. Gerar draft do contrato
  4. (após aceite) Clonar formulário de indicação com vendedor correto
  5. Ativar cupons
  6. Gerar link de acesso + QR codes
- Nova tool do Copilot `credenciar_profissional` que chama esse pipeline e devolve o status de cada etapa.

## Fora de escopo (não mexe)
- Funis Vendas/CS, LeadDetailPanel, Evolution/WaLeads, regras de comissão existentes.
- Links de token já enviados continuam funcionando (redirect).

## Verificação
- Teste do fluxo completo com um profissional de teste (is_test=true): cadastro → contrato → aceite → formulário clonado com vendedor certo → QR codes → login por celular.
- Conferir que nenhum dado de teste aparece em relatórios (views reportable).
