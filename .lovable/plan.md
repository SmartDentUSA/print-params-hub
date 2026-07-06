## Diagnóstico

O grupo **"[Smart Dent] Pré-Venda - Exocad por assinatura!"** (`120363425605712771@g.us`, 40 membros) está cadastrado em `wa_groups` **apenas** na instância `smartdent_marketing`. A Central de Campanhas filtra `WaGroupMultiSelect` por `instance_name = selectedInstance`, então ele não aparece quando a instância "Danilo-Henrique" está selecionada.

## Ação

Nenhuma alteração de código necessária. Fluxo operacional:

1. Na Central de Campanhas de Grupos, no seletor de instância no topo, trocar de **"Danilo-Henrique"** para **"smartdent_marketing"**.
2. O grupo "[Smart Dent] Pré-Venda - Exocad por assinatura!" passará a aparecer na lista do `WaGroupMultiSelect`.
3. Selecioná-lo normalmente e prosseguir com o disparo/agendamento.

## Alerta importante antes do disparo

O registro atual desse grupo tem `is_admin = false`. Isso significa que o número da instância `smartdent_marketing` **não é admin** do grupo. Consequências:

- Se o grupo estiver configurado como **"apenas admins podem enviar mensagens"** no WhatsApp, o disparo vai falhar (Evolution retorna erro de permissão).
- Se estiver aberto para todos os membros, o disparo funciona normalmente.

Antes de agendar uma campanha grande, recomendo:
- Fazer 1 disparo de teste manual para esse grupo pela instância `smartdent_marketing`.
- Se der erro de permissão, promover o número da instância a admin no WhatsApp e rodar o sync de grupos para atualizar `is_admin=true` em `wa_groups`.

## Fora de escopo

- Não vou mexer no filtro do `WaGroupMultiSelect` para "ver todos os grupos independente da instância" — isso quebraria a lógica de qual número envia o quê e pode causar disparos falhos em massa.
- Não vou sincronizar esse grupo sob a instância Danilo-Henrique — só faz sentido se o número dele for adicionado como membro/admin no WhatsApp real, o que é uma ação manual fora do sistema.
