# LIA de campanha + botão WhatsApp nas landing pages SDR

## O que o usuário verá
1. **Botão flutuante do WhatsApp** em todas as landing pages de formulários SDR. Ao clicar, abre a Dra. LIA (`/embed/dra-lia`) já sabendo o produto de interesse do formulário (ou do botão de interesse escolhido).
2. **Link de campanha da LIA**: `admin.smartdent.com.br/embed/dra-lia?c=<campanha>&p=<produto>` com UTMs. Dentro da Central de Campanhas, um botão **"Gerar link da LIA"** copia o link pronto. Cada campanha pode ter uma mensagem de abertura e um produto de interesse.
3. **Conversa de qualificação**:
   - Abertura personalizada ("Olá! Vi que você se interessou pela Resina Vitality…").
   - Procura o lead pelo telefone e, se não achar, pelo e-mail. Se não existir, confirma nome, e-mail e telefone.
   - Assim que tiver os três dados, **cria o lead no CRM com as mesmas regras de um formulário normal**:
     - Origem: `# CHAT - Landing - [produto]` (ou `# CHAT - Campanha - [campanha]` no link de campanha)
     - Produto de interesse: o produto indicado
   - Continua com as mesmas perguntas de qualificação do formulário (tem impressora, tem scanner, imprime modelos, placas, guias, resinas de longa duração…). Cada resposta é gravada na ficha do lead.
4. **Encerramento**: ao terminar a qualificação, ou depois de cerca de 3 minutos sem resposta com o vendedor já designado, a LIA diz:
   "Acabei de designar um especialista de produto para te atender e, com as informações que você me passou, ele não tomará seu tempo."
   Em seguida mostra um cartão com **a foto do vendedor** e o botão **"Me chame agora no WhatsApp"**. O link é `wa.me/<vendedor>` com o texto:
   "Olá {vendedor}, quero saber mais sobre o {produto}, e meu atendimento já foi registrado com número {ID do negócio no CRM}."

## Regras preservadas
- O lead entra pelo mesmo caminho dos formulários (ingestão e atribuição de vendedor). A Golden Rule, as travas contra negócios duplicados e a proteção de deals de Vendas/CS ficam como estão.
- O chat é uma origem com intenção comercial, porque tem um nome de formulário/origem. Por isso pode criar o negócio, como um formulário.
- A origem do Person continua congelada no primeiro contato. A origem do negócio segue a campanha/landing.
- Nada muda no Evolution/WaLeads nem no `LeadDetailPanel.tsx`.
- Se o vendedor não tiver foto ou WhatsApp cadastrado, o cartão aparece com as iniciais dele, e o botão usa o WhatsApp geral da Smart Dent.

## Detalhes técnicos
- **Banco**: em `campaigns`, adicionar `lia_slug` (único), `lia_opening_message` e `lia_product_name`.
- **Front**:
  - `PublicFormPage.tsx`: novo componente `LiaWhatsAppFab`, que abre `/embed/dra-lia?form=<id>&p=<produto>&src=landing` em um modal ou nova aba.
  - `AgentEmbed`/`DraLIA.tsx`: lê `c`, `form`, `p` e as UTMs, guarda tudo em `sessionStorage` e envia esse contexto para a função `dra-lia`.
  - Central de Campanhas: campos novos e o botão "Gerar link da LIA".
- **`dra-lia`**:
  - Novo modo `campaign_capture`: usa a mensagem de abertura, faz a busca telefone → e-mail e, quando tiver os 3 dados, chama `smart-ops-ingest-lead` com `form_name` igual à origem `# CHAT - Landing - [produto]` e o `produto_interesse` indicado.
  - Depois disso, faz as perguntas a partir de `smartops_form_fields` do formulário de origem, ou de um conjunto padrão de qualificação, e grava as respostas nas colunas mapeadas (`tem_impressora`, `tem_scanner`, `imprime_*`…).
  - Ao terminar, devolve `seller_card` com nome, foto, telefone e o ID do negócio, lido de `deals`/`team_members`.
- **Inatividade**: o próprio widget, depois de cerca de 3 minutos parado, consulta se já há vendedor e negócio e mostra o cartão.
- **Métricas**: a origem do chat entra nas conversões de formulários/campanhas pelas regras atuais de histórico de submissões.
