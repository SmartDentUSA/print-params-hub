# Registro da migração do domínio Smart Dent para a Vercel

Data: 13/10/2026 — fuso America/Sao_Paulo.
Projeto: Sistema B / SmartDentUSA/print-params-hub.
Este registro distingue configurações confirmadas de etapas orientadas ainda não confirmadas.

## Objetivo e escopo
Exibir a página institucional da base de conhecimento em https://www.smartdent.com.br/ e encaminhar https://smartdent.com.br/ para o endereço com www. Preservar o layout, o conteúdo, o uso do Lovable/Supabase/SmartOps e os demais serviços.

O Sistema A foi retirado do escopo por decisão do usuário. O Sistema B já utiliza o fluxo Lovable → GitHub (main) → Vercel. Não foi necessário integrar o PR #25 para a troca básica de hospedagem: a produção já identifica www.smartdent.com.br e renderiza KnowledgeBase em português com forcedTab="institucional".

## Estado anterior
- DNS autoritativo: KingHost, nameservers dns1.kinghost.com.br a dns6.kinghost.com.br.
- A @ → 212.85.6.6: domínio principal hospedado no Hostinger.
- CNAME www → smartdent.com.br.: www também chegava ao Hostinger.
- A admin → 185.158.133.1: Lovable.
- CNAME parametros e s → b7bba1d85a5f78c8.vercel-dns-017.com.: Vercel.

## Alterações confirmadas
### www.smartdent.com.br
1. Associado ao projeto print-params-hub na Vercel, ambiente Production.
2. Tentativas de editar o CNAME para o destino recomendado pela Vercel e para parametros.smartdent.com.br foram rejeitadas pelo painel KingHost ao sair do campo. A causa da rejeição não foi confirmada.
3. O usuário removeu o CNAME www → smartdent.com.br.
4. Criados dois registros A, usando os IPs recomendados pela API da Vercel para o domínio:

| Tipo | Nome | Destino |
|---|---|---|
| A | www | 216.198.79.1 |
| A | www | 64.29.17.1 |

Validação: a tela enviada mostrou Valid Configuration. A consulta final da Vercel retornou configuredBy=A, esses dois IPs, ausência de conflitos e misconfigured=false. A captura do navegador no chat mostrou a página institucional em https://www.smartdent.com.br/.

Não deve existir CNAME e A simultaneamente para o mesmo nome www.

### smartdent.com.br, sem www
- Adicionado ao mesmo projeto da Vercel.
- Configurado redirecionamento 308 permanente para www.smartdent.com.br.
- A API confirmou redirect=www.smartdent.com.br e redirectStatusCode=308.
- A tela DNS Records solicitou A @ → 216.198.79.1.
- Foi orientado substituir somente o destino do registro A @, de 212.85.6.6 para 216.198.79.1.

PENDÊNCIA: a última consulta ainda retornou A @ → 212.85.6.6 e misconfigured=true. Não houve confirmação de salvamento/propagação dessa última troca. Não registrar a migração do domínio sem www como concluída até validá-la.

## Configuração final desejada

| Tipo | Nome | Destino | Situação nesta revisão |
|---|---|---|---|
| A | @ | 216.198.79.1 | Solicitada pela Vercel; ainda não confirmada |
| A | www | 216.198.79.1 | Confirmada |
| A | www | 64.29.17.1 | Confirmada |

Não copiar IPs de implantação, FTP ou parâmetros diferentes: estes valores foram obtidos para o projeto/domínio. Caso a Vercel altere sua recomendação futuramente, conferir novamente Settings → Domains.

## Serviços preservados
Nenhuma alteração foi solicitada para:
- admin (Lovable), parametros e s (Vercel);
- loja / www.loja (VTEX), ead, clube, campanha e pnp;
- firebird, pgsql, mysql e mssql;
- autoconfig, autodiscover, mail, imap, pop, smtp, smtpi e webmail;
- MX @ com prioridade 5: mx-vip-01.kinghost.net. e mx-vip-02.kinghost.net.;
- TXT de SPF, DKIM, DMARC, Google, Facebook, D4Sign e verificação Lovable;
- nameservers KingHost.

Não houve transferência da zona DNS para a Vercel, exclusão do Hostinger, migração de banco de dados, alteração de RLS ou credenciais. O fluxo automático de publicação do Sistema B permanece existente.

## Validação para encerrar a migração
1. Confirmar na KingHost o salvamento de A @ → 216.198.79.1.
2. Na Vercel, usar Refresh em smartdent.com.br e aguardar configuração válida.
3. Verificar DNS: @ resolve para 216.198.79.1; www resolve para os dois IPs acima, sem CNAME antigo.
4. Testar HTTPS nos dois endereços.
5. Confirmar que smartdent.com.br retorna 308 para www.smartdent.com.br.
6. Testar um caminho público com parâmetros de consulta, conferindo preservação do caminho e da consulta no redirecionamento.
7. Conferir a página institucional, navegação da base de conhecimento, parametros/SmartOps, loja e e-mail.
8. Registrar data, resultado e evidências. Durante a propagação, caches de DNS podem mostrar resultados diferentes; comparar sempre o mesmo endereço, com ou sem www.

## Reversão
Para voltar ao estado anterior:
1. Restaurar A @ → 212.85.6.6.
2. Remover somente os dois registros A www da Vercel.
3. Recriar CNAME www → smartdent.com.br. (o painel pode acrescentar o ponto final).
4. Preservar todos os demais registros.
5. Verificar propagação e HTTPS. O site antigo depende de a hospedagem Hostinger e seus arquivos continuarem disponíveis.

## SEO e código: trabalho separado
O PR #25 permanece em rascunho e não foi mesclado para esta migração. Contém uma proposta adicional de HTML completo, metadados e preservação de URLs antigas; não é parte da configuração DNS já concluída.

A auditoria identificou pendências em metadados de imagem/compartilhamento, entidades, dados de eventos e desempenho. A troca de DNS, por si só, não corrige essas pendências nem garante indexação ou classificação "10/10". A prévia não deve ser confundida com a produção atual.

## Referências
- Projeto: https://vercel.com/smart-dents-projects/print-params-hub
- Repositório: https://github.com/SmartDentUSA/print-params-hub
- PR separado: https://github.com/SmartDentUSA/print-params-hub/pull/25
- Site: https://www.smartdent.com.br/
- Documento no Drive: https://docs.google.com/document/d/1GshuVytM_7RzBj6M_yGnqiQjF-uKjNmNHRSMl5Te5oM/edit
