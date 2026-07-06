## Enriquecer o produto no catálogo a partir do playbook

O produto **Ativação DentalCAD Ultimate Lab Bundle - RMS** já existe em `system_a_catalog` (`id 1821453d-fcdf-46b4-968a-63ae16119dab`, `external_id manual-1783378576576`, `slug ativacao-dentalcad-ultimate-lab-bundle-rms`), mas está com `price=0`, `technical_specs={}` e sem várias informações que o playbook fornece.

Vou fazer um único `UPDATE` na linha, mapeando o playbook para as colunas existentes — sem criar tabelas novas e sem tocar em outros produtos.

### Mapeamento playbook → colunas

| Coluna | Valor |
|---|---|
| `product_subcategory` | `DentalCAD - exocad` |
| `price` | `1199.00` (mensalidade recorrente) |
| `promo_price` | `null` (não há promoção; ativação é separada) |
| `description` | Descrição longa do playbook (~linha 74) — preserva se já preenchida, sobrescreve |
| `technical_specs` (jsonb) | 12 pares chave/valor das Especificações Técnicas (linhas 89–101): software, modalidade, módulos, créditos IA, casos/exportações, tipo de licença, internet, investimento inicial, mensalidade, compatibilidade, material, restrição regional |
| `compatibility_list` (text[]) | `["Scanners intraorais","Scanners de bancada","Impressoras 3D","Fresadoras"]` |
| `clinical_indications` (text[]) | `["Coroas","Pontes","Inlays/Onlays","Facetas","Pilares personalizados","Próteses parafusadas","PPRs","Próteses totais","Placas oclusais"]` |
| `keywords` (text[]) | `["exocad","DentalCAD","RMS","assinatura mensal","Ultimate Lab Bundle","CAD odontológico","laboratório digital"]` |
| `extra_data` (jsonb, merge) | Adiciona chaves não mapeadas para colunas: `pitch`, `pricing_model` (activation/monthly), `workflow_stages` (3 estágios), `required_products` (Scanner Medit i700, T310, Elegoo Mars 5 Ultra, Rayshape Edge Mini, Miicraft Alpha, Smart Slice, Crédito Exocad IA), `brand: exocad`, `loja_integrada_id: 402002410`, `availability: out_of_stock`, `unit: unidade` |
| `last_sync_at` | `now()` |

Merge no `extra_data` via `extra_data || '{...}'::jsonb` para não perder o que já está lá.

### O que fica de fora (fora do escopo desta tarefa)

Estes dados do playbook não têm coluna direta e o playbook mostra vazio/pendente — não vou inventar valores:

- Benefícios / Características / Público-alvo → "não definidos" no playbook
- FAQ, blogs, WhatsApp, YouTube, Instagram, TikTok → todos "pendentes"
- Comparação com concorrentes → não configurada
- CTAs 1/2/3 → não configurados
- GTIN/EAN/MPN, NCM, dimensões, peso → todos N/A no playbook
- Vídeos (5) e 100 links inteligentes → já vivem em outras tabelas (`knowledge_videos`, tabela de links) e não pertencem a `system_a_catalog`

Se quiser, depois eu faço um passo 2 gerando esses campos via IA (Lovable AI Gateway) — mas isso é outro plano.

### Execução

1. Chamar o **insert tool** (para dados) com um `UPDATE public.system_a_catalog SET ... WHERE id='1821453d-fcdf-46b4-968a-63ae16119dab'`.
2. Rodar um `SELECT` de verificação para confirmar que os campos foram preenchidos.
3. Nenhuma alteração de código frontend/edge function.

### Confirmações necessárias antes de executar

- **Preço**: uso `price = 1199` (mensalidade). A ativação R$ 2.390 vai em `extra_data.activation_fee`. OK ou prefere `price=2390`?
- **Descrição**: sobrescrevo a atual pela do playbook, ou preservo se já existir e uso a do playbook só se estiver vazia?
