## Mapeamento completo de produtos — Export XLSX

Vou gerar um único arquivo `/mnt/documents/mapa_produtos_sistema.xlsx` (Excel, multi-abas) consolidando todos os locais onde um nome/ID de produto aparece no banco. A primeira aba é a **reconciliação cruzada** (o "master") — as demais são o dado bruto de cada fonte, para auditoria.

### Fontes que serão lidas (contagens reais do banco agora)

| Fonte | Tabela | Registros | O que representa |
|---|---|---|---|
| Catálogo Sistema A/B | `system_a_catalog` (active) | **351** | Verdade canônica: id, external_id (Sistema A / Loja Integrada), slug, category |
| Mapeamento 7×3 | `workflow_cell_mappings` type=product | 156 | Produtos ligados a células do grid 7×3 (card do lead) |
| Motor de Regras | `opportunity_rules` | 1 | source_item + target_product_name (praticamente vazio) |
| Formulários | `smartops_form_fields` c/ `workflow_cell_target` | 444 | Campos de form + opções que produzem nomes de produto |
| Propostas / vendas | `deal_items` | 458 nomes / 1.096 SKUs | Produtos vendidos no CRM PipeRun (com SKU, cod_produto, valor) |
| Aliases | `produto_aliases` | 161 | Variantes de nomenclatura → nome canônico |
| Campanhas Meta | `campaigns` + `campaign_produto_map` | 7 + 8 | Produtos de interesse por campanha |
| Cards do lead | `lia_attendances` (equip_* / sdr_*_interesse / status_*) | ~29k leads | Valores distintos preenchidos manualmente ou por form |
| CRM sales (agregado) | `crm_product_sales` | 0 | Vazio hoje — mantido para completude |

### Estrutura do XLSX (9 abas)

**Aba 1 · `Master_Reconciliacao`** (a aba que você provavelmente vai usar)  
Uma linha por nome distinto encontrado em qualquer fonte, com as colunas:
- `nome_normalizado` (lowercase/trim)
- `nome_exibicao`
- `catalog_id` (uuid — id no Supabase Sistema B, mesmo do Sistema A)
- `catalog_external_id` (id Loja Integrada / Sistema A externo)
- `catalog_slug`
- `loja_integrada_url` (montada como `https://loja.smartdent.com.br/{slug}`)
- `catalog_category` / `subcategory`
- `deal_item_skus` (lista SKUs distintos encontrados em `deal_items`)
- `deal_item_cod_produto` (códigos internos das propostas)
- `aliases` (de `produto_aliases`)
- `alias_canonico` (nome canônico apontado pelo alias)
- Colunas booleanas de presença: `em_catalogo`, `em_mapeamento_7x3`, `em_motor_regras_source`, `em_motor_regras_target`, `em_form_fields`, `em_deal_items`, `em_campaign_map`, `em_lead_card_equip`
- `celulas_7x3` (lista das células stage.cell onde aparece)
- `qtd_deals` (quantas vezes aparece em `deal_items`)
- `status_match` (`exato_catalogo` / `fuzzy_catalogo` / `sem_match_catalogo` / `entrada_generica`)

**Aba 2 · `Catalogo`**  
Dump direto de `system_a_catalog` (active=true): id, external_id, source, category, subcategory, name, slug, price, active, approved, visible_in_ui, updated_at, wikidata_qid.

**Aba 3 · `Mapeamento_7x3`**  
`workflow_cell_mappings`: workflow_stage, workflow_cell, mapping_type, mapped_value, mapped_label + junção com catálogo (catalog_id, catalog_name, match_status).

**Aba 4 · `Motor_Regras`**  
`opportunity_rules`: workflow_stage, workflow_cell, source_item, action_type, target_product_name, useful_life_months, active + match do target no catálogo.

**Aba 5 · `Form_Fields`**  
`smartops_form_fields` que têm `workflow_cell_target`: form_id, form_name, field label, db_column, field_type, options (listadas linha a linha quando é radio/select/checkbox), workflow_cell_target + match de cada opção no catálogo.

**Aba 6 · `Deal_Items_Produtos`**  
Agregado por `product_name` em `deal_items`: nome, sku (lista), cod_produto (lista), qtd_ocorrencias, valor_medio, primeira/última data, product_category, product_subcategory + match no catálogo. (458 linhas.)

**Aba 7 · `Produto_Aliases`**  
`produto_aliases`: nome_variante, nome_canonico, categoria, subcategoria, sku_interno, ativo + match do canonico no catálogo.

**Aba 8 · `Campanhas_Meta`**  
Join `campaigns` × `campaign_produto_map`: campaign name/status/canal, produto vinculado, catalog_id + interesse de produto capturado em anúncios Meta.

**Aba 9 · `Lead_Card_Equip_Values`**  
Valores DISTINTOS preenchidos nas colunas de equipamento e interesse do card do lead em `lia_attendances` (apenas `merged_into IS NULL`): coluna de origem (`equip_scanner`, `equip_impressora`, `sdr_scanner_interesse`, `sdr_impressora_interesse`, `impressora_modelo`, `sdr_scanner_modelo`, etc.), valor, contagem de leads, match no catálogo.

### Como o match com o catálogo é feito
1. **Exato** — `lower(trim(nome)) = lower(trim(catalog.name))`
2. **Fuzzy** — LIKE bidirecional ignorando prefixos genéricos comuns (`Scanner Intraoral `, `Impressora 3D `, `Softwares CAD `, `Resina 3D `, `Equipamento `) que a auditoria anterior mostrou serem a maior causa de drift
3. **Alias** — se o nome estiver em `produto_aliases.nome_variante`, usa `nome_canonico` para o match
4. **Sem match** — marcado `sem_match_catalogo` para revisão

### Entrega
- Arquivo: `/mnt/documents/mapa_produtos_sistema.xlsx`
- Também vou gerar `/mnt/documents/mapa_produtos_sistema__master.csv` com só a aba 1 (para abrir rápido em qualquer editor).

### O que não vou fazer nesta tarefa (para não sair do escopo)
- Não vou alterar dado em nenhuma tabela (`workflow_cell_mappings`, `system_a_catalog`, `produto_aliases`, etc.)
- Não vou mexer em código do app nem em Edge Functions
- Não vou criar UI de download — é um artifact único gerado por script Python (openpyxl) rodando no sandbox

### Confirme antes de eu executar
1. **Escopo do catálogo**: só produtos `active=true`, ou incluir também os inativos/não aprovados? (padrão que vou seguir: `active=true`, com uma coluna booleana `approved` visível.)
2. **Loja Integrada URL**: confirmar se o padrão é `https://loja.smartdent.com.br/{slug}` — se for outro, me diga o template.
3. **Campos do lead card**: quer que a aba 9 inclua também `insumos_adquiridos`, `impressora_modelo`, `software_cad` e os `sdr_*_interesse`, ou apenas os `equip_*`? (padrão: incluir todos os campos de equipamento + interesse listados na skill do projeto.)

Se estiver ok assim, aprova e eu já rodo a geração do XLSX.
