# Fase 0 — Reconhecimento do cadastro de produtos (plataforma N7 Digital)

**Status anterior**: 35 categorias criadas com sucesso no Catálogo de Produtos da N7 (`Categorias (35)`).
**Agora**: antes de cadastrar 123 produtos, o Claude no Chrome precisa **entender o processo** e voltar com o mapa do formulário. Nada de cadastro em massa nesta fase.

**Por que uma fase de reconhecimento**: cadastrar 123 produtos errado custa mais que cadastrar zero. Duas incógnitas decidem o esforço inteiro — se a plataforma tem importação em massa (CSV/API) e quais campos ela exige. Um piloto de 2 produtos responde as duas.

---

## 1. O que já sabemos da tela

| Observação | Consequência |
|---|---|
| Área: **Catálogo Produtos** → `Categorias (35)` e `+ Novo produto` | Categoria e produto são cadastros separados. |
| Filtro `Todos (2)` | **Já existem 2 produtos cadastrados.** São a referência de preenchimento — abrir antes de criar qualquer coisa. |
| Todas as 35 categorias mostram `(0)` | Nenhum dos 2 produtos existentes está classificado nas categorias novas. Verificar se precisam ser reclassificados. |
| Subtítulo da página: *"links de venda, preços, diferenciais e pack de fotos — insumo da criação e da IA"* | A N7 usa o catálogo para alimentar criação e IA. Prioridade de preenchimento: **link de venda > preço > diferenciais > fotos**. |
| Chips no formato `1. Captura Digital > Scanner Intraoral (IOS)` | A plataforma **não** tem hierarquia pai/filho — usou o formato de item único com prefixo, como previsto no briefing. |

---

## 2. O que a base tem para alimentar (123 produtos, Sistema A)

| Campo na base | Preenchidos | Observação |
|---|---|---|
| Nome | 123 | completo |
| Preço | **94** | 29 produtos com preço `0` — equipamentos “sob consulta” |
| Preço promocional | 15 | só consumíveis em campanha |
| Link de venda (`product_url`) | 114 | 9 sem link |
| Imagem principal | 111 | URLs externas (Supabase Storage e CDN Loja Integrada) |
| Galeria de fotos | 106 | média de 5–6 imagens por produto |
| Descrição | 123 | **94 texto limpo, 29 com HTML legado sujo** (inline styles) |
| Diferenciais / benefícios | 80 | |
| Features | 80 | |
| Pitch de vendas | 82 | |
| Especificações técnicas | 93 | |
| Aplicações clínicas | 84 | |
| FAQ | 76 | |
| Palavras-chave | 80 | |
| Marca | 57 | 66 sem marca preenchida |
| EAN / GTIN | 1 | praticamente inexistente — não contar com isso |

---

## 3. Riscos já identificados (o piloto precisa resolver)

1. **29 descrições vêm com HTML sujo** herdado da Loja Integrada (`<p style="font-family: Verdana...">`). Se o campo da N7 for texto puro, esse HTML aparece cru na tela. Precisa saber se o campo aceita HTML, rich text ou só texto.
2. **29 produtos com preço `0`** (scanners, impressoras, softwares — venda consultiva). Precisa saber se o campo de preço aceita vazio/zero ou se exige valor > 0.
3. **Imagens são URLs externas.** Se a plataforma só aceitar upload de arquivo, o custo de 123 produtos × 5 fotos muda completamente de ordem de grandeza.
4. **9 produtos sem link de venda** e **66 sem marca** — saber se esses campos são obrigatórios.
5. **Um produto pode pertencer a mais de uma categoria?** Ex.: resinas aparecem em Impressão 3D, e os combos Chair Side Print atravessam 3 etapas.

---

## 4. Prompt da Fase 0 — colar no Claude no Chrome

> Cole na aba já aberta e autenticada no Catálogo de Produtos da N7.

```
Esta é uma tarefa de RECONHECIMENTO, não de cadastro em massa.
Objetivo: entender exatamente como se cadastra um produto nesta plataforma e me
devolver o mapa do processo. Você vai cadastrar no máximo 2 produtos-piloto.
NÃO cadastre mais nada além dos 2 pilotos. NÃO altere nem exclua os 2 produtos
que já existem. NÃO mexa nas 35 categorias já criadas.

PASSO 1 — Procurar importação em massa (mais importante de todos)
Antes de qualquer coisa, procure em toda a área de Catálogo/Produtos e nas
configurações se existe:
 - importação por CSV / planilha / Excel
 - importação por link de feed, XML ou API
 - opção de colar uma lista, duplicar produto ou criar em lote
Se existir, me diga onde fica, quais colunas o modelo pede e baixe/descreva o
arquivo de exemplo. Isso muda toda a estratégia — temos 123 produtos.

PASSO 2 — Estudar os 2 produtos que já existem
Abra o filtro "Todos (2)" e depois abra cada um dos 2 produtos em modo de edição.
Para cada um, me diga:
 - todos os campos que existem na ficha e o que está preenchido em cada um
 - em qual categoria estão classificados (ou se estão sem categoria)
 - como as fotos foram inseridas (upload de arquivo ou URL)
Não salve nem altere nada. Apenas observe e feche.

PASSO 3 — Mapear o formulário de "Novo produto"
Clique em "+ Novo produto" e mapeie o formulário INTEIRO, sem salvar ainda:
 - liste TODOS os campos, na ordem em que aparecem
 - para cada campo: nome exato do rótulo, tipo (texto curto, texto longo, número,
   moeda, data, seleção única, seleção múltipla, upload, URL, switch),
   se é obrigatório, limite de caracteres se houver
 - se for campo de seleção, liste TODAS as opções disponíveis
 - o campo de categoria: é seleção única ou múltipla? Tem busca? Aparecem as 35
   categorias que criamos?
 - o campo de descrição: é texto puro ou editor rich text? Aceita HTML colado?
 - o campo de imagem: aceita URL externa ou só upload de arquivo do computador?
   Quantas imagens aceita? Tem campo separado para foto principal e galeria?
 - o campo de preço: aceita vazio ou zero? Existe campo de preço promocional?
 - existe algum campo de código, SKU, referência interna ou tag?

PASSO 4 — Cadastrar o PILOTO A (consumível com preço)
Categoria: 3. Impressão 3D > Resinas 3D — Biocompatíveis
Nome: Resina 3D Smart Print Bio Bite Splint Clear
Marca: Smart Dent
Preço: 1711,12
Preço promocional: 599,50
Link de venda: https://loja.smartdent.com.br/bite-splint-clear
Imagem principal (URL): https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/products/8ea6c6fd-7ae4-4fcd-ae18-5a85a69f461f-1764283865017.webp
Descrição: Cor translúcida. Resina para confecção de placas miorrelaxantes e
placas de bruxismo, garante maior precisão e resultados extraordinários.
Diferenciais (se houver campo):
 - Alta precisão dimensional para placas oclusais
 - Resina biocompatível certificada
 - Acabamento translúcido de aspecto natural

Salve e me diga o que aconteceu. Se der erro, copie a mensagem exata.

PASSO 5 — Cadastrar o PILOTO B (equipamento sem preço público)
Este piloto existe para testar os dois casos difíceis: preço ausente e galeria
de fotos.
Categoria: 1. Captura Digital > Scanner Intraoral (IOS)
Nome: Scanner Intraoral MEDIT i700
Marca: MEDIT
Preço: NÃO temos preço público — este produto é venda consultiva.
  Tente nesta ordem: (1) deixar o campo vazio; (2) se for obrigatório, tente 0;
  (3) se nenhum funcionar, me avise antes de inventar qualquer valor.
Link de venda: https://loja.smartdent.com.br/scanner-intraoral-medit-i700
Imagem principal (URL): https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/products/12da64a4-1a41-4a15-b99b-711fdd9ff63a-1764283865488.webp
Descrição: O Scanner Intraoral MEDIT i700 oferece precisão de 10,9 μm em arcos
completos e captura de até 70 FPS em cores reais. Arquitetura aberta com
exportação sem restrição em STL, OBJ e PLY, para fluxos restauradores, CAD/CAM,
alinhadores e impressão 3D.
Diferenciais (se houver campo):
 - Escaneamento 3D ultrarrápido, até 70 FPS em cores reais
 - Plataforma aberta, compatível com qualquer fluxo CAD/CAM
 - Design leve e ergonômico, 245 g, com pontas autoclaváveis
Galeria: temos 6 fotos adicionais para este produto. Só me diga quantas fotos o
campo aceita e como (URL ou upload) — não precisa inserir todas agora.

Salve e me diga o que aconteceu.

PASSO 6 — Conferir o resultado
Volte para a lista de produtos e confirme:
 - os 2 pilotos aparecem
 - o contador da categoria "Resinas 3D — Biocompatíveis" mudou de (0) para (1)
 - o contador de "Scanner Intraoral (IOS)" mudou de (0) para (1)
 - o total saiu de "Todos (2)" para "Todos (4)"

ME ENTREGUE NO FINAL

A) Importação em massa: existe? Onde? Quais colunas? (resposta do Passo 1)

B) Tabela do formulário, uma linha por campo:
   Campo | Tipo | Obrigatório | Limite | Opções | O que coloquei no piloto

C) Respostas diretas:
   - A descrição aceita HTML colado ou vira texto cru na tela?
   - A imagem aceita URL externa ou exige upload de arquivo?
   - Quantas imagens por produto?
   - O preço aceita vazio ou zero?
   - Um produto pode ter mais de uma categoria?
   - Existe campo de SKU, código ou referência interna?
   - Quais campos são obrigatórios e NÃO temos na base?

D) Quanto tempo levou para cadastrar 1 produto do começo ao fim.

E) Qualquer coisa que te travou ou que exigiu adivinhação.

Não invente dado nenhum. Se faltar informação, deixe em branco e me diga.
```

---

## 5. O que acontece depois do relatório

| Fase | Depende de | Ação |
|---|---|---|
| **1** | Resposta do Passo 1 | Se houver importação CSV: gero o arquivo com os 123 produtos nas colunas exatas da N7 e o trabalho acaba em uma tarde. Se não houver: seguimos para cadastro assistido. |
| **2** | Tabela de campos (item B) | Gero o lote de fichas prontas, produto por produto, já no formato dos campos reais — com descrição limpa (removendo o HTML legado dos 29), preço formatado e regra definida para os 29 “sob consulta”. |
| **3** | — | Cadastro por etapa do fluxo, na ordem 1 → 7, com conferência do contador de cada categoria ao fim de cada bloco. Prioridade para as etapas de maior volume: 5. Finalização (73 produtos), 3. Impressão 3D (23) e 7. Fresagem (12). |

**Decisão pendente**: os 2 produtos que já existiam no catálogo precisam ser reclassificados nas 35 categorias novas? Isso o relatório da Fase 0 vai deixar claro.
