## Objetivo

Criar 52 novos formulários no sistema (`smartops_forms` + `smartops_form_fields`) replicando exatamente o fluxo de perguntas, condicionais e configurações visuais do formulário **`ioconnect`** (id `f4e0effb-6012-402c-b00b-b57483d371fc`), variando apenas: `slug`, `name`, `title` e (quando houver match) `product_catalog_id` / `workflow_stage_target`.

## Fonte

CSV anexado com 52 linhas (`Nome | Produto interesse | Slug | Etapa fluxo SDR`). Slugs verificados — nenhum colide com formulários existentes.

## Como funciona o clone

O `ioconnect` tem **17 campos** em `smartops_form_fields` com lógica condicional (`conditions.show_if.rules[].field_id` aponta para UUIDs de outros campos do mesmo form). Por isso o clone não pode ser um `INSERT … SELECT` simples — precisa remapear IDs.

Para cada formulário do CSV:

1. `INSERT INTO smartops_forms` copiando TODAS as colunas visuais/comportamentais do ioconnect (theme, hero, brand_color, layout_variant, tracking_*, success_message, display_mode, etc.), substituindo só:
   - `slug` ← CSV col 3
   - `name` ← CSV col 1 (ex: `# - FORMS - IOS - MEDIT i600`)
   - `title` ← CSV col 2 (`Produto de interesse`) — o usuário pode depois personalizar
   - `workflow_stage_target` ← mapeado da coluna 4 do CSV (ex: `1 · Captura Digital - Scanner Intraoral` → `1_captura_digital_scanner_intraoral`)
   - `product_catalog_id` ← lookup por nome em `products_catalog` quando houver match exato; senão `NULL`
2. Clonar os 17 campos: gerar um `id` novo para cada e construir um **mapa `old_id → new_id`**. Reescrever `conditions` JSONB substituindo todos os `field_id` antigos pelos novos antes do `INSERT`.

## Implementação técnica

**Migração única** com função PL/pgSQL `clone_ioconnect_form(p_slug, p_name, p_title, p_stage, p_product_id)` que:

- copia a linha de `smartops_forms` (RETURNING new_id);
- itera os 17 fields do source criando novos UUIDs em uma CTE/temp map;
- aplica `jsonb_set` recursivo nas `conditions` trocando os field_ids.

Depois um bloco `DO $$` lê os 52 registros (insiro via `VALUES (...)` no próprio migration, gerado a partir do CSV) e chama a função para cada um.

```text
CSV (52 rows)
   │
   ▼
clone_ioconnect_form()
   ├─ INSERT smartops_forms (clone visual + overrides)
   ├─ Para cada field do source:
   │     new_id = gen_random_uuid()
   │     id_map[old_id] = new_id
   ├─ Rewrite conditions JSONB usando id_map
   └─ INSERT smartops_form_fields (17 linhas com novos IDs)
```

## Mapeamento de etapa (col 4 CSV → workflow_stage_target)

Slugificação simples: lowercase, remover `·`, espaços→`_`, acentos→ascii. Ex:
- `1 · Captura Digital - Scanner Intraoral` → `1_captura_digital_scanner_intraoral`
- `3 · Impressão 3D -  Resinas` → `3_impressao_3d_resinas`

(Se preferir reaproveitar exatamente os valores já usados no sistema — ex: o ioconnect usa `1_captura_digital__acessorios` — me avise e eu uso o vocabulário existente.)

## Entregáveis

1. Uma migração SQL com a função + 52 chamadas.
2. Após aplicada: 52 formulários acessíveis em `/f/{slug}` com o **mesmo fluxo condicional** do ioconnect.

## O que NÃO altero

- O formulário ioconnect original.
- Conteúdo dos fields (labels, options, conditions) — vão idênticos.
- Nenhum código frontend / edge function.

## Pontos a confirmar

- **Title**: usar o nome do produto (col 2) como title de cada form? Ou manter o título original do ioconnect e você ajusta depois no editor?
- **workflow_stage_target**: gerar slugs novos a partir da col 4 do CSV (como acima) ou só preencher quando bater com um valor já existente?
