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
1. Identificação do produto (botões acima)
2. Sequência padrão SDR a partir do nome (igual ao exocad RMS)
3. Perguntas condicionais do produto escolhido, já existentes no formulário daquele produto
4. Encaminhamento ao vendedor e WhatsApp

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

## Para confirmar
- Os 6 objetivos da primeira tela estão certos? Faltam serviços ou distribuição?
- A identificação deve vir antes do nome (recomendado, porque engaja mais) ou só depois do telefone?
