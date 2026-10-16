# Formulário de credenciamento gerado na publicação do curso profissional

## Objetivo

Ao publicar um curso do profissional (`professional_courses`), o sistema gera automaticamente o formulário de credenciamento com o nome padronizado **`# CHAT - Qualificação Curso - {Nome do Profissional}`**, reutilizando campos e listas de opções já existentes em outros formulários do sistema — sem criar novas opções, para não quebrar a segmentação.

## Campos do formulário (todos reutilizados de formulários existentes)

1. **Seu nome completo** — `nome`, texto, obrigatório
2. **Seu e-mail** — `email`, e-mail, obrigatório
3. **Seu WhatsApp (com DDD)** — `telefone`, phone, obrigatório
4. **Qual é a sua área de atuação?** — `area_atuacao`, select, obrigatório (lista já existente)
5. **Qual é a sua especialidade?** — `especialidade`, texto, opcional
6. **Atualmente, você digitaliza suas moldagens?** — `tem_scanner`, select, com exatamente as mesmas opções usadas hoje nos formulários do sistema ("AINDA NÃO DIGITALIZO AS MOLDAGENS", "SIM, COM SCANNER INTRA ORAL PRÓPRIO", "SIM, COM SCANNER INTRAORAL ALUGADO", "SIM, COM SCANNER INTRAORAL DA RADIOLOGIA PARCERIA", "SIM, COM SCANNER INTRAORAL DA LABORATORIO PARCEIRO", "SIM, COM SCANNER DE BANCADA")
7. **Qual impressora você teve contato ou utiliza no seu dia a dia?** — `impressora_modelo`, select, com a mesma lista de marcas já usada (RAYSHAPE, PHROZEN, ANYCUBIC, FLASHFORGE, WANHAO, MIICRAFT, MOONRAY, SPRINTRAY, STRAUMAN, FORMLABS, STRATASYS, ELEGOO, ENVISIONTEC, 3DSYSTEM, PIONEXT, CREALITY, ACKURETTA, PHOTOCENTRIC, KULZER, WILCOS, OUTRAS)

Os campos 6 e 7 usam os mesmos `db_column`, rótulos e opções dos formulários existentes (ex.: "# - FORMS - Acesso Grupo Smart Dent"), garantindo que a ingestão (`smart-ops-ingest-lead` / canonicalização de equipamentos) e a segmentação continuem funcionando sem nenhum mapeamento novo.

## Mudanças

### 1. Geração no momento da publicação (não mais sob demanda)

- Hoje o formulário é criado preguiçosamente dentro da ação `own_course_stats` da edge `professional-course-portal` (quando alguém abre o portal). Isso será movido para o **momento da publicação**:
  - No fluxo de publicação da equipe (`ProfessionalCoursesModal.tsx`, ação `publish`), após o curso ser marcado como `publicado`, chamar uma nova ação `ensure_credenciamento_form` da edge `professional-course-portal` (autenticada, escopada ao curso).
  - A ação é **idempotente**: se o curso já tem `credenciamento_form_id`, apenas retorna o existente (mantém compatibilidade com cursos já publicados e com o formulário já criado no curso de teste).
- A criação sob demanda em `own_course_stats` permanece como fallback para cursos já publicados antes desta mudança, mas passa a usar o mesmo padrão de nome e campos.

### 2. Nome do formulário

- Padrão: `# CHAT - Qualificação Curso - {Nome do Profissional}` (nome do profissional vindo do lead vinculado ao curso).
- Slug único derivado do título do curso (com verificação de colisão, como já existe).
- `form_purpose`: `credenciamento` (valor permitido pela constraint atual), ativo.

### 3. Ingestão e CRM (sem mudanças de regra)

- A origem fixa `# CHAT - Qualificação Curso - Profissional` já é aplicada no `lia-capture` para formulários vinculados a `professional_courses.credenciamento_form_id` — mantida.
- Como os campos usam `db_column` canônicos (`tem_scanner`, `impressora_modelo`), o enriquecimento de equipamentos do lead funciona automaticamente.

## O que NÃO será alterado

- Regras de ingestão/CRM, funis Vendas/CS, `LeadDetailPanel.tsx`, exceção "cliente ganho → só nota".
- Formulários existentes e suas opções — apenas reutilizados, nunca editados.
- Pipeline de reels/IG Flow já existente.

## Verificação

- Publicar um curso de teste (rascunho novo, não o `[TESTE KOL]` publicado) e confirmar: formulário criado com o nome `# CHAT - Qualificação Curso - {Profissional}`, 7 campos com as opções corretas, `credenciamento_form_id` vinculado.
- Confirmar idempotência: republicar não duplica o formulário.
- Abrir o portal do profissional e confirmar que o CTA "Quero participar" abre o chat com o formulário.
