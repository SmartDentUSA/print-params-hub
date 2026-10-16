# Meus dados — organização completa no Portal Profissional Parceiro

## Objetivo

Reorganizar a seção **Meus dados** do portal do profissional (`/portal-cursos/:token`) para espelhar a ficha do profissional do sistema, em blocos ordenados, com edição pelo próprio profissional e os dados de contrato (tipo de pessoa, documento, PIX) alimentando a geração do contrato.

## Estrutura da seção (ordem dos blocos)

1. **Perfil profissional** — foto, nome, CRO, área de atuação, especialidade, mini-CV (já existe; mantém no topo).
2. **Dados do contrato**
   - Tipo de pessoa: **Física** ou **Jurídica** (seletor).
   - Nome completo (legal) — pré-preenchido com o nome do perfil profissional, editável.
   - **Pessoa Física selecionada:** campos CPF + Chave PIX habilitados; CNPJ/Chave PIX de PJ desabilitados.
   - **Pessoa Jurídica selecionada:** campos CNPJ + Chave PIX habilitados; CPF desabilitado.
   - A seleção do tipo de pessoa habilita apenas o bloco correspondente e é o que alimenta a geração do contrato (`kol_contracts.person_type`, `legal_name`, `document`, `pix_key`).
3. **Endereço profissional** — CEP, endereço, cidade, estado (`prof_cep`, `pessoa_endereco`, `prof_city`, `prof_state`).
4. **Contatos WhatsApp** — WhatsApp pessoal e WhatsApp de cursos (já existem: `prof_wa_ddi/number`, `prof_course_wa_ddi/number`).
5. **Cadastros e redes sociais** — Instagram, TikTok, YouTube, site (já existem).
6. **Qualificações do profissional — Formação acadêmica** — reutiliza o componente `ProfessionalQualifications` (graduação, especialização, mestrado, doutorado, pós-doutorado com instituição MEC, curso e conclusão), lendo/gravando `prof_qualifications`.
7. **Funções no ambiente universitário** — mesmo componente, lendo/gravando `prof_university_roles`.

## Implementação técnica

- **Edge Function `professional-course-portal`**:
  - Ampliar `PROFILE_FIELDS` com: `prof_cep`, `pessoa_endereco`, `pessoa_cpf`, `empresa_cnpj`, `prof_qualifications`, `prof_university_roles` (somente leitura/escopo do próprio `lead_id` do token, como hoje).
  - Nova ação `save_contract_data`: grava `person_type`, `legal_name`, `document` (CPF ou CNPJ conforme o tipo), `pix_key` no contrato ativo do profissional (`kol_contracts`), com validação: documento obrigatório e coerente com o tipo de pessoa; PIX obrigatório. Se ainda não houver contrato, os dados ficam salvos no lead (campos `pessoa_cpf`/`empresa_cnpj`) e são usados quando o contrato for gerado.
  - `save_profile` passa a aceitar também os novos campos de endereço, qualificações e funções universitárias (JSONB).
- **Frontend** (`src/components/smartops/courses/portal/`):
  - Novo componente `PortalMyData.tsx` organizando os blocos acima, reutilizando `ProfessionalQualifications` e `PhoneInputWithDDI`.
  - Seletor Tipo de pessoa com habilitação condicional dos campos de documento/PIX.
  - `ProfessionalCoursePortal.tsx`: seção "Meus dados" passa a renderizar o novo componente.

## O que NÃO será alterado

- Regras de geração/assinatura do contrato já implementadas (modal, assinatura digital, PDF no Drive).
- Funis, ingestão de leads, `LeadDetailPanel.tsx`, guardas do Painel Comercial.
- Nenhum dado inventado: campos sem valor aparecem vazios para o profissional preencher.

## Verificação

- Build + teste com o token de exemplo: blocos na ordem correta, seleção PF/PJ habilitando os campos certos, salvamento refletindo na ficha do profissional e no contrato.
