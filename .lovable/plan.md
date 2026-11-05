# WhatsApp Oficial dentro do fluxo "Criar campanha"

## O que muda
Remover a aba separada "Disparo em massa WhatsApp Oficial" e colocar o canal dentro do assistente existente:

1. **Criar campanha** — no seletor "Canal de envio" aparece a nova opção **WhatsApp Oficial (Zernio)**. Ao escolher, mostra o número oficial conectado (+55 16 3419-4735) em vez da instância Evolution.
2. **Segmentar Leads** — mesma tela de filtros de hoje, sem mudança. Contagem considera só leads com telefone válido e sem fichas mescladas.
3. **Template e mapeamento** (nova etapa 3 para esse canal):
   - Lista de templates **aprovados** na Meta (nome, idioma, categoria, prévia do texto).
   - Para cada variável do template (`{{1}}`, `{{2}}`, cabeçalho, botão com URL) um seletor com campos do sistema: primeiro nome, nome completo, empresa, cidade, produto de interesse, vendedor responsável, último formulário, cupom, ou texto fixo.
   - Prévia ao vivo com dados de um lead real do segmento; aviso para leads com campo vazio (usa valor padrão definido pelo usuário).
4. **Revisar e enviar** — resumo (público, template, mapeamento), envio e histórico/status no detalhe da campanha, como nos outros canais.

## Detalhes técnicos
- `SmartOpsCampaigns.tsx`: adicionar `SelectItem value="whatsapp_oficial"`, carregar conta via `zernio-wa-broadcast` action `accounts`; no step 3 renderizar novo componente `WhatsAppTemplateMapper` (extraído de `WhatsAppOfficialBroadcastTab.tsx`) recebendo `buildFiltersObject()` e contagem; remover a aba separada.
- `zernio-wa-broadcast` action `send`: aceitar `filters` (mesmo objeto do wizard, resolvido no servidor com `merged_into IS NULL`) além de segment IDs, e `variable_map` `{ posição: { field | literal, fallback } }`; resolver valores por lead no servidor, dedupe por telefone, gravar `campaigns` (canal `whatsapp_oficial`), `campaign_sessions` e `campaign_send_log`.
- Sem alterações em Evolution/WaLeads, deals ou CRM. Conversions API continua fora deste escopo.
- Validar com deploy + teste visual do assistente; disparo real só com sua confirmação.
