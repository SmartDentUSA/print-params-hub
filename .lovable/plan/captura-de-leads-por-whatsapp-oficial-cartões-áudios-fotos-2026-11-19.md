# Captura de leads por WhatsApp Oficial (cartões, áudios, fotos)

## Como funciona para o vendedor
1. O vendedor (telefone cadastrado em Team Members) manda para o número oficial: foto do cartão de visita, áudio, foto de anotações, foto/vídeo de produto ou catálogo.
2. Tudo o que o vendedor mandar vira **uma oportunidade** até ele enviar a palavra **FIM**. Aí o sistema processa e cria o lead. (Se esquecer o FIM, o sistema lembra após 30 min e fecha sozinho após 2 h.)
3. O sistema responde no WhatsApp: "Recebido — criando lead de *Nome*" e depois "Lead criado no CRM ✅" (ou o que faltou, ex.: sem telefone nem e-mail).
4. Telefones que não são da equipe são ignorados por essa ferramenta (seguem o fluxo atual do inbox).

## Três tipos de envio (qualquer pessoa da equipe)
Ao primeiro envio, o sistema pergunta com botões o que é:
1. **Lead do evento**: mesmo caminho do simulador WhatsApp e do formulário de cadastro de leads do evento e com a origem do formulário de leads do evento. **O dono é o vendedor que enviou**, que fica como consultor do evento. A regra de Vendas continua valendo: se outro vendedor já tem negócio avançado com essa pessoa, nada muda nele e o vendedor que enviou recebe um aviso.
2. **KOL evento**: mesmo caminho do formulário "Interessados em KOL" (funil 109840, etapa Interesse, Beatriz, origem `[KOLEXPANSÃO] - evento`).
3. **Oportunidade do evento**: funil 109841, com a Beatriz como dona (fluxo abaixo).

O vendedor também pode começar já com a palavra LEAD, KOL ou OPORTUNIDADE. Os três tipos usam a mesma leitura por IA, a mesma pasta no Drive e a mesma nota completa. Muda só para onde o lead vai no CRM.

## O que o sistema faz
- **Lê tudo com IA**: transcreve áudios, lê cartões e anotações (OCR) e identifica nome, e-mail, telefone, área de atuação, especialidade, cidade, estado, endereço, empresa e produtos do catálogo citados (só produtos ativos do catálogo, nome exato).
- **Drive**: descobre o evento acontecendo na data do envio (fuso São Paulo) e cria, dentro da pasta do evento, a pasta com o nome da oportunidade. Fotos e vídeos são salvos com o nome da oportunidade (ex.: `Joao Silva - 01.jpg`). Sem evento no dia → pasta "Sem evento/AAAA-MM-DD".
- **CRM (funil 109841)**: cria/encontra a pessoa (nunca sem e-mail ou telefone), cria o negócio na primeira etapa do funil 109841 com a **Beatriz como dona** (o vendedor que enviou fica registrado na nota e na timeline), com:
  - Origem: `[CAPTURA WHATSAPP] - nome do evento` (mesmo padrão do KOL Expansão)
  - Produto de interesse, área de atuação, cidade, estado, endereço
  - Nota com: transcrição completa de cada áudio, texto lido de cada imagem, resumo da IA de tudo e links do Drive de cada arquivo e da pasta.
- **Timeline do lead** e contagem no card do evento, como os outros formulários do evento.
- Se o lead já tem negócio aberto no Funil de vendas, ele não é mexido (regra de Vendas preservada); o negócio vai só no 109841.

## Tela no sistema
Aba "Capturas WhatsApp" no evento: lista de oportunidades recebidas com status (recebendo, processando, criado, erro), dados extraídos editáveis antes de reenviar ao CRM, e botão "Reprocessar".

## Detalhes técnicos
- Entrada: `zernio-whatsapp-inbox` já grava em `whatsapp_inbox`; novo trigger despacha `wa-field-capture` quando o remetente casa com `_shared/team-phone-match.ts` e a conta é a do número oficial. Evolution/WaLeads intocados.
- Tabelas novas: `field_capture_sessions` (team_member, event_id, status, dados extraídos, deal_id, drive_folder) e `field_capture_items` (wamid único p/ idempotência, tipo, drive_file_id, transcrição/OCR). RLS: só admin/equipe; grants corretos.
- Fechamento da sessão: mensagem exata "FIM" fecha e processa; cron de rede de segurança lembra após 30 min e fecha após 2 h de inatividade.
- IA: Lovable AI Gateway (Gemini para OCR/visão e transcrição de áudio; extração estruturada com schema fixo; sem inventar dados — campo vazio se não houver).
- Drive: reutiliza `_shared/drive.ts` e a pasta do evento (`smartops_events.drive_folder_id`, cria via `event-create-drive-folder` se faltar).
- CRM: nova função `field-capture-crm-sync` no molde de `kol-expansao-crm-sync` (piperunGet/Post/Put, contact_emails/phones, origem criada se não existir, etapa inicial lida do funil 109841), ingest via `smart-ops-ingest-lead` usando o formulário do evento conforme o tipo: `feira_evento` (lead), `kol_expansao` (KOL) ou um novo formulário de sistema inativo `oportunidade_evento` por evento (109841), para origem e conversões ficarem iguais aos demais formulários.
- Respostas ao vendedor: mensagem de texto dentro da janela de 24h (o vendedor acabou de escrever).

## Validação
Enviar de um telefone da equipe um cartão + áudio de teste, conferir pasta no Drive, nota e negócio no 109841, e apagar o teste no CRM.
