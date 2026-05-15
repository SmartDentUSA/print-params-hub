## Contexto

Pesquisei o catálogo de cursos (`src/components/SmartOpsCourses.tsx`). Há **um único botão "Editar" por curso** (linha 434, no header do `CourseCard`), e a tabela de turmas (linhas 444-479) hoje não tem botão de Editar nem coluna de ações por turma — só mostra Data / Horário / Inscritos / Vagas.

Como o pedido é "ao lado do botão Editar **em cada turma**" e tecnicamente esse botão por turma não existe, vou seguir a intenção (1 botão `Gerar Doc` **por turma**, já que a Edge Function recebe `turma_id`) e adicionar uma nova coluna **"Ações"** ao final da tabela de turmas.

## Mudanças

### 1. Criar `src/components/GerarDocButton.tsx`
Conteúdo exatamente como você forneceu — chama `smartops-gerar-doc-turma?turma_id=...` com o JWT do usuário, baixa `.docx`, mostra toast.

### 2. Editar `src/components/SmartOpsCourses.tsx`
- Importar `GerarDocButton`.
- Na tabela de turmas (linhas 444-479):
  - Adicionar `<th className="text-right py-1.5 font-medium">Ações</th>` ao `<thead>`.
  - Adicionar `<td className="py-1.5 text-right">` com `<GerarDocButton turmaId={t.id} turmaLabel={t.label || t.start_date} />` em cada linha.

Nada mais é alterado — filtros, ordenação, lógica de inscrições e o botão "Editar" do curso permanecem intactos.

## Confirmação necessária

Se você na verdade queria o botão **no header do curso, ao lado do "Editar" do curso** (e não por turma), me avise — nesse caso ele não receberia `turma_id` e precisaríamos decidir qual turma usar. Confirmando a abordagem por turma, eu implemento.