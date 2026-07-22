## Diagnóstico
Há dois parents representando o mesmo produto em `system_a_catalog`:

- **"Resina 3D Smart Print L'Aqua"** — canônico, tem SKUs (1209/1210/1211/1212) e GTINs válidos (0756014745146 / 153 / 160).
- **"Resina Smart Print Modelo Láqua"** — duplicata legada, variações sem SKU, GTINs colidem (mesmos códigos 756014745146/153/160) e três linhas `grs` fantasmas.

Confirmado antes na auditoria de normalização (L'Aqua/Modelo Láqua duplicação em parents).

## Escopo desta ação
**Apenas o TXT** `/mnt/documents/arvore-7-etapas-workflow-produtos.txt` — sem tocar em banco nesta rodada (o merge no `system_a_catalog` fica pendente para uma migração separada, se aprovado).

## Mudanças no arquivo
1. Suprimir o parent **"Resina Smart Print Modelo Láqua"** da célula `3 · Impressão 3D → Resina`.
2. Manter só **"Resina 3D Smart Print L'Aqua"** com suas 4 variações canônicas (SKUs 1209–1212).
3. Recalcular contadores da célula Resina e totais do rodapé.
4. Adicionar nota discreta no rodapé:
   `⚠️ Duplicatas de parent detectadas (fora do TXT): "Resina Smart Print Modelo Láqua" → merge no banco pendente.`

## Passos
1. Ajustar `/tmp/tree/build.py` com blacklist do parent duplicado (por `id` ou nome exato).
2. Reaproveitar `/tmp/tree/parents.txt` e `vars.txt`.
3. Reemitir o TXT como artefato.

## Fora do escopo
- Nenhum `UPDATE`/`DELETE` em `system_a_catalog` ou `catalog_product_variations`.
- Merge real dos parents e limpeza dos GTINs colididos → posso propor migração dedicada depois se você quiser.
