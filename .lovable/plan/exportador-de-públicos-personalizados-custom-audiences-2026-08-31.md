# Exportador de Públicos Personalizados (Custom Audiences)

Nova ferramenta em **Configurações → Dados** (ao lado de "Exportar Dados"), para gerar arquivos de público no formato aceito por plataformas de anúncios (padrão OpenAI Custom Audiences): e-mails e telefones brutos ou com hash SHA-256, ou GAIDs, em CSV com cabeçalhos ou TXT com um valor por linha.

## O que o usuário verá

Um card "Públicos Personalizados (Ads)" com:

1. **Fonte do público**
   - Base de leads canônicos (somente leads não mesclados)
   - Filtros: status do lead, período (primeiro contato), somente clientes / somente com compra, somente com e-mail válido (exclui bounced), excluir opt-out de SMS/WhatsApp
   - Contador ao vivo: "X e-mails, Y telefones elegíveis"
   - Alternativa: **colar/enviar lista própria** (para GAIDs, que não existem na base — ver observação)

2. **Identificadores**
   - E-mail, Telefone, ou ambos (CSV), ou GAID (apenas via lista própria)
   - Telefone normalizado em E.164 (`+55...`), e-mail em minúsculas e sem espaços — normalização obrigatória antes do hash

3. **Formato**
   - **CSV com cabeçalhos**: colunas `email` e/ou `phone` (ou `email_sha256` / `phone_sha256` quando hasheado)
   - **TXT**: um valor por linha, com seleção separada do tipo de identificador (e-mail, telefone ou GAID)

4. **Hash**
   - Alternar entre "bruto" e "SHA-256" (hex minúsculo), aplicado após a normalização
   - Aviso na tela: enviar bruto ou hasheado é equivalente para a plataforma; hash é recomendado por privacidade

5. **Botão Exportar** — gera o arquivo e baixa direto no navegador, com nome tipo `audience-emails-sha256-2026-08-31.csv`, e mostra o total de linhas exportadas.

## Observação sobre GAIDs

A base do Sistema B não armazena Android Advertising IDs (nenhuma coluna de GAID/IDFA existe hoje). Portanto o GAID é suportado apenas no modo "lista própria": o usuário cola ou envia um arquivo de GAIDs e a ferramenta valida (formato UUID), remove duplicados e devolve no formato TXT/CSV escolhido, com hash opcional. Se no futuro passarmos a coletar GAIDs (app/push), a fonte pode ser plugada no mesmo componente.

## Detalhes técnicos

- Novo componente `src/components/AdminAudienceExport.tsx`, renderizado na aba `data` de `src/components/AdminSettings.tsx` logo após `<DataExport />`.
- Consulta paginada (1000 linhas por página) em `lia_attendances` com `merged_into is null`, selecionando apenas `email`, `telefone_normalized` e as colunas usadas nos filtros (`lead_status`, `email_bounced`, `sms_opt_out`, `whatsapp_opt_out`, data de primeiro contato) — nada de `select *`.
- Contagem prévia com `head: true, count: 'exact'` para o contador ao vivo.
- Normalização e hashing no cliente:
  - e-mail: `trim().toLowerCase()`
  - telefone: apenas dígitos, prefixo `+`, DDI 55 quando ausente (reaproveitando a normalização já usada no projeto)
  - hash: `crypto.subtle.digest('SHA-256', ...)` → hex minúsculo
- Deduplicação por identificador normalizado antes de escrever o arquivo; linhas vazias descartadas.
- Download via `Blob` + link temporário, como já faz `DataExport.tsx`. Sem nova tabela, sem edge function, sem migration.
- Sem alteração em `DataExport`, `DataImport` ou qualquer outra aba de Configurações.
