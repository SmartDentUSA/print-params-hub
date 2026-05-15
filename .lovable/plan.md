# Comprovante de Imersão & Retirada — DOCX por participante

Adicionar um botão por participante (na linha do inscrito e em cada linha de acompanhante) que gera o **.docx editável** da "Declaração de Comparecimento à Imersão, Treinamento Técnico e Retirada Presencial de Equipamento" preenchido só com os dados daquela pessoa.

## Localização do botão

Em `src/components/SmartOpsCourses.tsx`, ao lado do botão `Award` (Gerar certificado):
- **Linha do lead** (≈ linha 1064): novo `<ComprovanteButton enrollmentId={r.id} ... />`
- **Linha de cada companion** (≈ linha 1100): mesmo botão com `companionId={c.id}`

Ícone: `FileSignature` (lucide), tooltip: "Gerar comprovante de imersão". Spinner durante chamada. Faz download direto do `.docx`.

## Edge function: `smartops-gerar-comprovante-imersao`

Nova função em `supabase/functions/smartops-gerar-comprovante-imersao/index.ts`. Padrão idêntico ao `smartops-gerar-doc-turma` (JWT do usuário, retorna o blob).

**Input** (query string):
- `enrollment_id` (obrigatório)
- `companion_id` (opcional — se ausente, gera para o lead da inscrição)

**Pipeline**:
1. Validar JWT.
2. Buscar `smartops_enrollments` → `turma_id`, `lead_id`, dados do inscrito (nome, email).
3. Se `companion_id`: buscar `smartops_enrollment_companions` (nome, email, especialidade).
4. Buscar `smartops_course_turmas` → `start_date`, `end_date`, `label` da turma.
5. Buscar `lia_attendances` (canonical, `merged_into IS NULL`) do lead → `nome`, `empresa_nome`, `empresa_cnpj`, `empresa_endereco`, `empresa_cidade`, `empresa_uf`, `pessoa_cpf`.
6. Best-effort buscar Omie via `omie_billing_history` últimos 90 dias do CNPJ → últimas 1–2 NFs (campo `numero_nf` / `numero`).
7. Renderizar `.docx` com `docx-js` (npm:docx) reproduzindo o texto fiel ao PDF original (cabeçalho, 6 cláusulas, conteúdo programático I–V, assinatura, testemunhas, rodapé Smart Dent).
8. Preencher só item 4.1 com `Nome` (e CPF se houver). 4.2 e 4.3 ficam em branco com linhas pontilhadas.
9. Auto-preencher quando existir: nome do declarante, CPF/CNPJ, empresa, endereço, cidade/UF, datas da turma (item 2), NF (item 6). Campos faltantes ficam como `_______`.
10. Retornar como `application/vnd.openxmlformats-officedocument.wordprocessingml.document` com `Content-Disposition: attachment; filename="comprovante_<nome>_<turma>.docx"`.

## Componente novo

`src/components/ComprovanteImersaoButton.tsx` — espelha `GerarDocButton.tsx`, mas:
- props: `enrollmentId: string`, `companionId?: string`, `personName: string`, `turmaLabel?: string`
- chama `/functions/v1/smartops-gerar-comprovante-imersao?enrollment_id=...&companion_id=...`
- nome do arquivo: `comprovante_<personName>_<turmaLabel>.docx`

## Detalhes técnicos

- US Letter (12240 × 15840 DXA), margens 1".
- Fonte default Arial 12pt; títulos centralizados em negrito.
- Listas usando `LevelFormat.BULLET` e `LevelFormat.UPPER_ROMAN` (I–V), nunca caracteres unicode.
- Seções 4.1/4.2/4.3 com tab-stops e linhas pontilhadas via `PositionalTabLeader`.
- Tracked changes: nenhum. É um documento limpo para impressão.
- Sem bucket de storage — stream direto ao browser (fire-and-forget, igual ao `smartops-gerar-doc-turma`).

## Não alterar

- Lógica do botão de certificado existente.
- Layout/colunas da tabela.
- Edge function `smartops-gerar-doc-turma` (turma agregada continua intacta).
- Schema do banco (sem migração).
