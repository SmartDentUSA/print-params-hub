# Nova conversão de lead no início do Funil de Vendas

## O que significam os "61 pulados"
Essa rotina antiga só reenviava ao CRM leads que estavam sem negócio. Os 61 já tinham um negócio aberto em Vendas ou CS. Pela Regra de Ouro, o sistema não mexeu neles: não criou negócio novo e não registrou a nova conversão no CRM. A regra abaixo resolve isso nas próximas vezes.

## Nova regra (exceção à Regra de Ouro)
Quando um lead converte de novo por um destes canais:
- formulário de interesse em produto
- formulário de indicação (KOL)
- formulário de leads de evento
- campanha Meta (Zernio)
- simulador de WhatsApp

e já tem um negócio **aberto no Funil de Vendas** em uma destas etapas:
**Sem contato, C1, C2, C3 ou SDR / Nutrição**

o sistema faz isto:
1. Move o negócio aberto para o **Funil Estagnados**, na etapa **"Leads que converteram em campanhas mesmo estando no funil comercial"**.
2. Fecha esse negócio como **perdido**, com o motivo **"Converteu em outra campanha"**.
3. Cria um negócio novo em Vendas, na etapa Sem contato, com a origem e o produto da nova conversão e a nota "Resumo do Lead" atualizada.
4. Sorteia o vendedor entre os vendedores ativos.
5. Registra tudo na linha do tempo do lead, com um alerta para o vendedor anterior.

## O que continua protegido
- Negócios nas etapas Apresentação/Visita, Proposta enviada, Negociação, LTV e Fechamento ficam como estão. A nova conversão só vira nota e entra na linha do tempo.
- Negócios ganhos, de CS Onboarding e de Ganhos Aleatórios (CS) nunca são alterados.
- Uma nova entrega do mesmo envio pela Meta não conta como conversão nova. A trava contra negócios duplicados continua valendo.
- Os formulários de indicação com vendedor fixo mantêm a regra atual: o vendedor é o do formulário, sem sorteio.

## Antes de construir (pré-requisitos no PipeRun)
- A etapa "Leads que converteram em campanhas mesmo estando no funil comercial" não aparece entre as etapas do Funil Estagnados que o sistema conhece. Vou consultar o PipeRun. Se ela não existir, você precisa criá-la, ou eu a crio pela integração se a conta permitir.
- O motivo de perda "Converteu em outra campanha" também precisa existir no PipeRun. Vou procurar e, se não houver, ele precisa ser criado.

## Os 61 do passado
Eles não são alterados automaticamente. Depois que a regra estiver no ar, faço uma lista desses 61 e mostro quais se encaixariam nela, para você aprovar.

## Detalhes técnicos
- Em `_shared/golden-rule-guard.ts`, criar o veredito `reconvert_early_stage`. Ele vale para um deal Vendas aberto com `stage_id` em {99293, 99294, 675815, 675813, 379942} quando a origem é um dos canais da lista acima. Re-entrega com o mesmo `zernio_lead_id` ou com o mesmo dedupe de submissão nunca usa esse veredito.
- Criar o helper `_shared/reconversion-handoff.ts`, que faz: PUT do deal para o pipeline 72938 na nova etapa → close lost com `lost_reason_id` → `createNewDeal` com a cascata de Origem/Produto da nota → sorteio pelo distribuidor de vendedores ativos que já existe. Os passos rodam em ordem, sob o lock atômico de criação de deal que já existe.
- Chamar o helper em `smart-ops-lia-assign`, que é usado por formulários, simulador, eventos e indicação, e no fluxo Zernio/Meta, que passa pelo `ingest-lead`.
- Ler os IDs da nova etapa e do motivo de perda em `piperun-field-map.ts`, depois de confirmados no PipeRun.
- Gravar eventos em `lead_activity_log` (`deal_reconversion_moved`, `deal_reconversion_created`).
- Adicionar testes Deno: uma etapa elegível gera handoff, uma etapa avançada preserva o deal, uma re-entrega Meta é ignorada e CS e deals ganhos não são tocados.
- Registrar a regra em `AGENTS.md` e na documentação da skill.
