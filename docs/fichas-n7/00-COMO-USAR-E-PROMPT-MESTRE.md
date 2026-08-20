# Cadastro de produtos na N7 — instruções e prompt mestre

## Como este pacote funciona

O Claude no Chrome **não tem acesso ao Supabase**. Ele enxerga só o navegador. Por isso a base dos dois sistemas já foi consultada e condensada aqui: cada ficha traz nome, marca, preço, link de venda, foto principal, galeria, descrição, diferenciais, **público-alvo**, aplicações clínicas e especificações técnicas — que é exatamente o que a N7 pede ("links de venda, preços, diferenciais e pack de fotos — insumo da criação e da IA").

**Não peça ao Claude no Chrome para "consultar a RAG" ou "verificar o Sistema A e B".** Ele não consegue, e o resultado seria conteúdo inventado. O que ele pode fazer, quando faltar algo, é abrir o **link de venda** da própria ficha em outra aba e ler a página pública do produto — isso é permitido e está no prompt.

## Arquivos

| Arquivo | Conteúdo | Produtos |
|---|---|---|
| `etapa-1-captura-digital.md` | Scanners, acessórios | 9 |
| `etapa-2-cad.md` | exocad, exoplan, créditos IA | 4 |
| `etapa-3-impressao-3d.md` | Resinas 3D, impressoras, slicer, acessórios | 22 |
| `etapa-4-pos-impressao.md` | Cura, limpeza e acabamento | 9 |
| `etapa-5-finalizacao.md` | Caracterização, cimentos, dentística (**formato ficha-mãe + variantes**) | 73 |
| `etapa-6-cursos.md` | Cursos (sem conteúdo — ler recomendação) | 2 |
| `etapa-7-fresagem.md` | ATOS Block (sem conteúdo nas demais) | 1 + 11 pendentes |
| `solucoes-chair-side-print.md` | Combos transversais | 3 |

**Ordem sugerida**: comece pela **Etapa 1** (9 produtos, fichas completas, bom para calibrar o ritmo), depois **3**, **4**, **2**, e deixe a **5** por último — é a maior e usa o formato de ficha-mãe.

Cole **um arquivo por vez** junto com o prompt mestre. Não cole os oito de uma vez.

---

## Prompt mestre — colar no Claude no Chrome

```
Você vai cadastrar produtos no Catálogo de Produtos da N7 Digital, nesta aba.
Vou colar em seguida um arquivo de fichas com os produtos de uma etapa.

COMO CADASTRAR CADA PRODUTO
1. Na lista de categorias, clique no chip exatamente igual ao campo
   "Categoria N7" da ficha. Ex.: `1. Captura Digital > Scanner Intraoral (IOS)`
2. Clique em "+ Novo produto".
3. Preencha os campos do formulário com os dados da ficha, casando cada campo
   da plataforma com o campo equivalente da ficha (nome, marca, preço, link,
   foto, descrição, diferenciais, público-alvo, aplicações, especificações).
4. Salve.
5. Confirme na tela que o produto aparece e que o contador da categoria subiu.
6. Só então vá para o próximo produto.

REGRAS QUE NÃO PODEM SER QUEBRADAS
- NUNCA invente dado. Nem preço, nem descrição, nem benefício, nem foto.
- Campo da ficha marcado como "NÃO TEMOS" ou "não temos" → deixe o campo vazio
  na plataforma e anote no relatório final. Não preencha com texto genérico.
- Preço "sob consulta (não publicar valor)" → NÃO digite valor nenhum. Se o
  campo for obrigatório, PARE nesse produto, anote e siga para o próximo.
- Copie os textos como estão. Pode ajustar quebras de linha e formatação para
  caber no campo, mas não reescreva, não resuma e não traduza.
- Não altere nem exclua nada que já exista na plataforma.
- Se um produto já estiver cadastrado, não duplique: anote e siga.

FOTOS
- "Foto principal" é a imagem do card. "Fotos extras" vão na galeria.
- Se a plataforma aceitar URL, cole a URL. Se exigir upload, me avise
  imediatamente e pare — não tente contornar.
- Fotos abreviadas com `.../arquivo.webp` precisam do prefixo indicado no fim
  do arquivo de fichas. Monte a URL completa antes de colar.

QUANDO FALTAR INFORMAÇÃO QUE A PLATAFORMA EXIGE
Você pode abrir o "Link de venda" da ficha em OUTRA aba e ler a página pública
do produto na loja para completar o que falta. Só use o que estiver escrito
nessa página. Se nem lá tiver, deixe vazio e anote.
Não use busca na web, não use outras fontes, não deduza a partir de produtos
parecidos.

SE O ARQUIVO FOR O DA ETAPA 5
Ele usa outro formato: uma "ficha-mãe" por linha de produto (SmartMake,
SmartGum, UNIKK Veneer, Atos Direta, Atos Academic) seguida de uma tabela de
variantes. Cadastre cada variante da tabela como um produto, usando o texto da
ficha-mãe da sua linha e trocando apenas nome, preço, link e foto pelos dados
da linha da tabela. Onde a ficha-mãe mandar acrescentar uma frase sobre a
tonalidade, acrescente.

RITMO
Cadastre no máximo 5 produtos e então me dê um resumo parcial antes de
continuar. Se algo der errado duas vezes seguidas, pare e me chame.

RELATÓRIO FINAL
- Tabela: produto | cadastrado / já existia / falhou / pulado | motivo
- Total cadastrado x total esperado da etapa
- Campos obrigatórios da plataforma que a ficha não cobre
- Produtos que ficaram incompletos e o que falta em cada um
- Qualquer campo em que você teve dúvida sobre onde colocar a informação
```

---

## Contagem esperada ao final

| Etapa | Produtos |
|---|---|
| 1. Captura Digital | 9 (1 sem nenhum conteúdo) |
| 2. CAD | 4 (1 sem conteúdo) |
| 3. Impressão 3D | 22 (2 slicers sem conteúdo) |
| 4. Pós-Impressão | 9 |
| 5. Finalização | 73 |
| 6. Cursos | 2 — **recomendado não cadastrar ainda** |
| 7. Fresagem | 1 (+11 tonalidades pendentes) |
| Soluções | 3 (só se houver área própria) |
| **Total cadastrável hoje** | **~117 de 123** |

## Lacunas que dependem do comercial, não da plataforma

1. **Cursos (2)** — sem preço, ementa, link ou foto. São produtos de topo de funil; cadastrá-los vazios não serve nem para a criação nem para a IA da N7.
2. **Slicers Smart Slice e SmartSlicer I.A. (2)** — sem qualquer conteúdo.
3. **Crédito Exocad DentalCAD I.A. (1)** e **Dispositivo BLZ Dental DMC (1)** — sem conteúdo.
4. **Combos Chair Side Print (3)** — sem foto; um deles tem o campo de link preenchido com o código `396844859` em vez de uma URL.
5. **ATOS Block (11 tonalidades)** — sem preço e sem link individuais.
6. **UNIKK Veneer A2** — o link aponta para a URL do A1. Provável erro de cadastro na origem.
7. **Resina Bio Temp B1** — preço promocional (R$ 732,00) praticamente igual ao cheio (R$ 733,34).

Itens 6 e 7 são erros na base de origem e valem correção no Sistema A, não só na N7.
