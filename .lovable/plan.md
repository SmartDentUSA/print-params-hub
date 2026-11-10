# Formulário do site com identificação do produto (formulário + simulador WhatsApp)

## Ideia central
Um único formulário "SITE - Atendimento geral". Ele não fica preso a nenhum produto. A primeira etapa descobre o interesse por meio de botões em 2 ou 3 toques. Em seguida o formulário segue exatamente a sequência padrão de SDR (nome, e-mail, telefone, área, especialidade...) e reaproveita as perguntas e opções que já existem.

## Desenho dos botões (minha recomendação: árvore por objetivo)
O dentista pensa no que quer fazer, não no nome do produto. Por isso a pergunta começa pelo objetivo e só termina no produto do catálogo.

```text
LIA: Olá! Como posso te ajudar hoje?

[ Imprimir em 3D no consultório ]   [ Escanear / moldagem digital ]
[ Planejar e desenhar (CAD) ]       [ Resinas e materiais ]
[ Cursos e treinamentos ]           [ Não sei, quero orientação ]

-> "Imprimir em 3D no consultório"
LIA: Você já tem impressora 3D?
[ Ainda não, quero comprar ]  [ Já tenho, quero resinas ]  [ Já tenho, preciso de suporte ]

-> "Ainda não, quero comprar"
LIA: O que pretende produzir primeiro?
[ Modelos e guias ]  [ Provisórios e coroas ]  [ Placas e alinhadores ]  [ Tudo / fluxo completo ]
   => produto sugerido do catálogo (ex.: kit chairside) + botão [ Confirmar ] [ Ver outra opção ]

-> "Planejar e desenhar (CAD)"
[ exocad DentalCAD ]  [ exoplan (implantes) ]  [ Serviço de CAD terceirizado ]

-> "Não sei, quero orientação"
   => interesse "Orientação geral"; segue para o contato e um vendedor é sorteado
```

Regras de desenho:
- Até 6 botões por tela, com textos curtos (até 4 palavras) e ícone pequeno.
- No máximo 3 níveis até chegar ao produto. Cada nível tem um botão "Voltar".
- Sempre existe a saída "Não sei / quero orientação", para ninguém travar.
- No último nível, mostrar o produto com foto e nome exato do catálogo antes da confirmação.
- Os mesmos botões aparecem no formulário do site e no simulador de WhatsApp. No simulador, viram botões de resposta rápida.

## Ordem do fluxo
1. Telefone primeiro, igual aos outros simuladores (reconhece o lead já cadastrado)
2. Identificação do produto (botões acima)
3. Sequência padrão SDR a partir do nome (igual ao exocad RMS), pulando o que já for conhecido
4. Perguntas condicionais do produto escolhido, já existentes no formulário daquele produto
5. Encaminhamento ao vendedor e WhatsApp

## O que vai para o CRM
- Origem: nome exato do formulário do site.
- Produto de interesse: nome exato do produto confirmado no catálogo. Se a pessoa escolheu "orientação", vai como interesse geral.
- Mantêm-se a Regra de Ouro e a regra de nova conversão a cada envio.

## Detalhes técnicos
- Criar via `fn_create_form_standard_flow` (clone do exocad RMS), com `form_purpose` `sdr_captacao`.
- A árvore usa perguntas de escolha já existentes, com condições. O nó final grava o produto pela mesma resolução de "botão de produto selecionado" que o LIA já usa, sem criar campo novo.
- A árvore fica numa configuração de mapeamento (objetivo -> categoria -> produto do catálogo), editável no editor de formulários.
- O simulador WhatsApp lê a mesma configuração, então as duas versões ficam sempre iguais.
- Para testar: um envio de teste de cada ramo, conferindo a origem/produto no deal e a timeline.

## Parte 2 — Botão "Resumo" em cada card do catálogo (estilo Gemini no Drive)
Cada card de produto ou resina ganha um botão "Resumo" com um ícone de brilho. Ao clicar, abre um painel com:
- Resumo estruturado do produto: para que serve, principais itens/cores, indicações e diferenciais, em tópicos, como na sua imagem do SmartGum
- Vídeos relacionados da Base de Conhecimento, com miniatura, que abrem no player
- Artigos relacionados da Base de Conhecimento
- Lista dos documentos já cadastrados (guias, fichas técnicas, manuais, IFU), cada um com os botões Abrir e Baixar
- Botões de ação que já existem no card (comprar, falar no WhatsApp/simulador)
- Idioma conforme a página (PT/EN/ES)

Como o resumo é gerado:
- A IA busca o que a base de conhecimento da Dra. LIA sabe do produto (artigos, vídeos e documentos indexados), junta com os dados técnicos e escreve o resumo uma única vez. O texto fica salvo, então o painel abre na hora e sem custo a cada clique.
- O resumo é refeito automaticamente quando um documento do produto muda. A equipe também pode refazê-lo pelo editor.
- O resumo nunca inclui preços (regra do projeto) e usa apenas o que está nos documentos, sem inventar.
- Produto sem documento: o painel mostra só a descrição e os dados técnicos, sem resumo de IA.

Detalhes técnicos da Parte 2:
- Uma nova função do servidor faz a mesma busca RAG da LIA (`agent_embeddings`, filtrada pelo produto), seleciona os vídeos (`knowledge_videos`) e artigos (`knowledge_contents`) ligados ao produto, e usa a IA da Lovable com `catalog_documents`/`resin_documents` e os dados técnicos. Ela salva o resumo por produto, idioma e versão dos documentos.
- O cache é exposto para leitura pública somente com o texto do resumo.
- O painel reaproveita o modal atual de documentos das resinas (`KbResinDocsDialog`) e passa a valer também para os produtos.

## Para confirmar
- Os 6 objetivos da primeira tela estão certos? Faltam serviços ou distribuição?
