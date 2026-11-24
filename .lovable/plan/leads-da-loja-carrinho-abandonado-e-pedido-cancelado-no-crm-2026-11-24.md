# Leads da loja: Carrinho abandonado e Pedido cancelado no CRM

## O que muda para você
Quando um cliente da Loja Integrada abandonar um carrinho ou tiver um pedido cancelado, o sistema cadastra o lead no CRM pelo mesmo caminho dos formulários, seguindo a Regra de Ouro:
- Origem exata: **[LOJA] - Carrinho abandonado** ou **[LOJA] - Pedido cancelado**
- **Produto de interesse**: lido da categoria do catálogo dos produtos do carrinho/pedido
- **Nota do lead** no PipeRun com o pedido: número, data, situação, itens (nome, quantidade, preço), categorias, valor, frete, forma de pagamento e cupom
- Registro na linha do tempo do lead

## Regras
- Regra de Ouro inalterada: se o lead já tem negócio de Vendas em etapa avançada, ganho ou CS, nada é movido; só a nota é adicionada. Se todos os negócios abertos estão em Sem contato/C1/C2/C3/SDR, cria novo negócio e o anterior vai para Estagnados (708585).
- Cada pedido conta uma única vez (o mesmo pedido reenviado pela loja não gera nova conversão).
- Pedido pago depois do carrinho abandonado não gera cadastro de carrinho.
- Sem e-mail e sem telefone: não cria pessoa no CRM (regra existente).
- Exceção autorizada à regra "e-commerce nunca cria negócio": vale só para estas duas origens.

## Detalhes técnicos
- Dois formulários de sistema inativos (form_purpose existente `sdr_captacao`, sem perguntas novas), nomes iguais às origens; ingestão via `smart-ops-ingest-lead` com `submission_id` = `loja:<tipo>:<pedido_id>`.
- Disparo em `smart-ops-ecommerce-webhook`: cancelado no evento `order_cancelled`; carrinho abandonado conforme a definição escolhida (verificação na rodada de polling já existente, sem cron novo).
- Categoria: itens casados com `system_a_catalog` por SKU/nome normalizado (`product_category`/`product_subcategory`); produto de interesse = nome exato do produto de maior valor; categorias listadas na nota.
- Testes Deno para: origem, deduplicação por pedido, categoria e exclusão de carrinho convertido.
- Atualizar memória (exceção ao Commercial Intent Guard) e AGENTS.md.
