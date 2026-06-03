## Objetivo

Cadastrar em `products_catalog` os produtos que faltam para linkar os 12 formulários hoje com `product_catalog_id = NULL`.

## Triagem dos 12 formulários sem produto

Dividi em 3 grupos. Só o Grupo A entra em `products_catalog`. Os outros têm casa própria.

### Grupo A — Produtos a criar em `products_catalog` (8)

| Slug | Nome | Categoria | Subcategoria |
|---|---|---|---|
| `blz-dental-dmc` | BLZ Dental DMC | Acessórios | Captura Digital |
| `ios-blz-leap500` | Scanner Intraoral BLZ Leap 500 | Scanners | Intraoral |
| `equipamento-uv-shapecure-d` | ShapeCure D — Pós-Cura UV | Equipamentos | Pós-Cura |
| `resina-3d-smartprint-bio-direct-aligner` | Resina 3D Smart Print Bio Direct Aligner | Resinas | Ortodontia |
| `resina-3d-smartprint-bio-go-white` | Resina 3D Smart Print Bio GOWhite | Resinas | Estética |
| `software-smart-slicer` | Software Smart Slicer | Software | Slicer 3D |
| `terceirizacao-projetos-cad` | Serviço de Terceirização de Projetos CAD | Serviços | CAD |
| (sem 8º — só 7) | | | |

### Grupo B — Cursos (3) — NÃO entram em `products_catalog`

`Curso-presencial`, `curso-presencial-imersao-3-dias-chairside`, `print-make-imersao-clinica` pertencem ao domínio `smartops_courses` / `astron_courses` (já documentado em Course Training Engine v6). Vou deixar `product_catalog_id = NULL` e, se quiser, adiciono em outro passo um `course_id` no `smartops_forms` apontando para `smartops_courses`.

### Grupo C — Acessos (2) — NÃO são produto comercial

`acess-grupo-smartdent` e `acesso-smart-dent-academy` são cadastros para grupos/área de membros, não produtos vendáveis. Ficam `NULL`.

## O que vou executar

1. **Migration**: `INSERT INTO products_catalog` para os 7 produtos do Grupo A com `product_id = gen_random_uuid()::text`, `name`, `category`, `subcategoria` preenchidos e demais colunas JSONB nulas/`'[]'::jsonb`. `clinical_brain_status = 'pending'` para sinalizar que precisam de enriquecimento depois.
2. **UPDATE smartops_forms.product_catalog_id`** para cada um dos 7 formulários do Grupo A, vinculando ao `product_id` recém-criado (uso CTE `INSERT ... RETURNING` + `UPDATE` no mesmo bloco para garantir atomicidade).
3. Grupos B e C ficam intocados (`product_catalog_id = NULL`).
4. Validação final: `SELECT count(*) FROM smartops_forms WHERE product_catalog_id IS NULL` deve cair de 12 para 5 (3 cursos + 2 acessos).

## Pergunta

Aprova o critério acima (Grupo A entra em catálogo, Grupos B/C não)? Ou quer que eu inclua os 3 cursos e 2 acessos também em `products_catalog` como entradas comerciais simples, mesmo não sendo SKUs físicos?
