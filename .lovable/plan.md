
## Plano: corrigir duplicação de resinas, restaurar documentos/info e deixar RESINAS pré-selecionada

### Diagnóstico confirmado
1. **Resinas duplicadas**
   - A página junta `system_a_catalog` + `resins`.
   - Em `system_a_catalog`, a categoria `RESINAS 3D` já tem **28 linhas para 14 resinas** (pares duplicados).
   - A deduplicação atual por nome exato falha porque os nomes não batem perfeitamente entre catálogo e resinas (`"Resina 3D ..."` vs `"Smart Print ..."`, acentos, prefixos etc.).

2. **Documentos e informações faltando**
   - A query atual de documentos traz só `document_name`, `document_category` e `file_url`, então **descrições** e **tipos** não chegam ao card.
   - Os botões **FDS/IFU** dependem só de `name.includes("fds"/"ifu")`, mas o banco também usa `document_type`.
   - Como há cards duplicados vindos do catálogo sem docs/SKUs, eles “competem” com os cards ricos da tabela `resins`.

3. **Categoria padrão não selecionada**
   - `selectedCategory` começa como `null`.
   - Falta um passo pós-carregamento para definir `RESINAS 3D` como categoria inicial.

### Implementação
1. **Reescrever a unificação dos dados em `src/pages/SupportResources.tsx`**
   - Deduplicar primeiro os itens de `system_a_catalog`, principalmente em `RESINAS 3D`.
   - Criar uma chave canônica por item com prioridade:
     1. `cta_1_url` normalizada
     2. `slug` normalizado
     3. nome normalizado sem prefixos como `Resina 3D`, sem acentos e sem ruídos
   - Dentro de cada grupo duplicado, manter o registro “mais completo” (com link, imagem e descrição).
   - Depois disso, ao mesclar com `resins`, **priorizar sempre o registro da resina** para a categoria `RESINAS 3D`.

2. **Trazer os campos certos para os acordeões**
   - Em `catalog_documents` e `resin_documents`, buscar também:
     - `document_description`
     - `document_type`
     - `file_name`
   - Mapear os docs com esses campos e usar `document_type` como critério principal para FDS/IFU.

3. **Corrigir os cards**
   - Manter os botões rápidos: **Loja**, **FDS**, **IFU**.
   - Validar URL antes de renderizar botão/link.
   - No acordeão de cada card:
     - **Descrição**: mostrar texto limpo ou estado vazio.
     - **Documentos**: listar todos os docs com nome + descrição quando existir.
     - **Apresentações (SKUs)**: só para resinas, incluindo `label`, `price`, `grams_per_print`, `prints_per_bottle`, `cost_per_print`; se não houver, mostrar “Sem apresentações cadastradas”.

4. **Definir RESINAS como padrão**
   - Ordenar categorias com `RESINAS 3D` em primeiro.
   - Após o carregamento, se existir `RESINAS 3D`, definir automaticamente:
     - `selectedCategory = "RESINAS 3D"`
   - Preservar a seleção manual se o usuário trocar de categoria.

### Arquivo afetado
- `src/pages/SupportResources.tsx`

### Validação após implementar
- A página deve abrir já em **RESINAS 3D**
- Cada resina deve aparecer **uma única vez**
- Resinas devem mostrar **documentos + apresentações (SKUs)** no acordeão
- Produtos devem mostrar **descrição e documentos** quando existirem
- Botões **Loja / FDS / IFU** não podem apontar para links vazios ou inválidos

### Detalhes técnicos
- Não precisa migração de banco nesta etapa; o problema é de **normalização, merge e renderização** no frontend.
- Vou manter a correção isolada na página `/support-resources`, sem alterar a Base de Conhecimento nem o schema.
