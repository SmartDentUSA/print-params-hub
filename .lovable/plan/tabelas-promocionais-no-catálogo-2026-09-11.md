# Tabelas promocionais no Catálogo

## Objetivo
Adicionar em **Gestão de Catálogo de Produtos** a aba **Tabelas promocionais**, para montar combos comerciais reutilizáveis em congressos, visitas e apresentações e exportá-los em PDF com o padrão visual Smart Dent.

## Experiência
- Nova aba ao lado de **Catálogo** e **Mapeamento de SKU**.
- Lista das tabelas promocionais com status, validade, responsável, vínculo opcional com distribuidor e ações de editar, duplicar e exportar.
- Editor para definir nome da promoção, título do PDF, período de validade, moeda, observações e distribuidor opcional.
- Seções livres e reordenáveis, como equipamentos, consumíveis, serviços, treinamentos ou outras criadas pelo usuário.
- Inclusão de produtos e variações do catálogo oficial, com busca, imagem, SKU e preço atual.
- Inclusão de linhas personalizadas para serviços, créditos, treinamentos ou benefícios que não sejam produtos do catálogo.
- Em cada linha: quantidade, valor de mercado, valor promocional/subsidiado e desconto calculado automaticamente.
- Totais por seção e resumo geral do combo.
- Pré-visualização e exportação em PDF, reaproveitando identidade, cabeçalho, paginação e tratamento de imagens da atual **SMART DENT — Price Table**.

## Persistência e segurança
- Criar tabelas próprias para promoções, seções e itens, sem alterar `dealer_price_lists`, `dealer_price_items`, Loja Integrada ou CRM `deals`.
- Guardar uma cópia dos nomes, valores e imagens usados em cada item para preservar o histórico do PDF quando o catálogo mudar.
- Acesso de criação e edição restrito a usuários administradores autenticados; vendedores/distribuidores poderão consultar conforme as permissões administrativas existentes.
- Aplicar permissões explícitas e proteção de acesso em todas as novas tabelas.

## PDF
- Documento A4 com marca Smart Dent, nome da promoção, validade e distribuidor quando houver.
- Seções na ordem definida pelo usuário, com produtos, valores, subsídio/desconto e subtotal.
- Resumo final com valor de mercado, valor promocional, economia total e percentual de desconto.
- Layout preparado para várias páginas sem cortar linhas, títulos ou totais.

## Validação
- Testar criação, edição, duplicação, reordenação e exclusão de seções e itens.
- Conferir cálculos com quantidades e descontos diferentes.
- Gerar e inspecionar visualmente um PDF com uma, duas e quatro seções, inclusive com quebra de página.
- Validar a nova aba em desktop e celular sem alterar o funcionamento das abas atuais.

## Detalhes técnicos
- Frontend React dentro de `AdminCatalog`, usando os componentes visuais existentes.
- Catálogo limitado à allowlist comercial já centralizada em `PRODUCT_CATALOG_ENTITY_TYPES`.
- Gerador PDF dedicado, reutilizando os padrões robustos de `DealerProposalExport` sem acoplar a promoção a uma tabela de distribuidor.
- Valores derivados serão calculados no editor e novamente no exportador para evitar divergência entre tela e PDF.
