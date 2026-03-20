

## Plano: Corrigir criação de deal no PipeRun e limpar dados corrompidos

### Problema identificado

O formulário "# - Formulário exocad I.A." não é reconhecido como `sdr_captacao`, então o `ingest-lead` envia `trigger: "ingest-lead"` (não `"sdr_captacao_reativacao"`). Quando o `lia-assign` processa, ele encontra deals existentes para a pessoa (deal `25658331` no "Distribuidor de Leads") e entra no branch de atualizar deal existente em vez de criar um novo no Funil de Vendas.

Dois problemas distintos:
1. **O nome corrompido** (`"22/8/2023 6:52 Zapier..."`) permanece no banco
2. **Nenhum deal novo** foi criado no Funil de Vendas — o deal antigo do "Distribuidor de Leads" foi mantido

### Correções

#### 1. Migration: corrigir nome corrompido do lead
- SQL UPDATE no `lia_attendances` para setar `nome = 'Danilo Henrique'` onde `email = 'danilohen@gmail.com'`

#### 2. Lógica de deal no `lia-assign` — tratar pipeline "Distribuidor de Leads" como não-ativo
Atualmente, `findPersonDeals` retorna deals de QUALQUER pipeline. Se houver um deal aberto no "Distribuidor de Leads" (pipeline 70898), o sistema o trata como ativo e apenas atualiza.

**Correção no Step 5e** (`smart-ops-lia-assign/index.ts`, ~linha 1124):
- Adicionar um check para que deals abertos em pipelines "passivos" (Distribuidor de Leads, Ebook, Ganhos Aleatórios) **não** bloqueiem a criação de um novo deal no Funil de Vendas
- Especificamente: `vendaDeal` deve filtrar apenas `PIPELINES.VENDAS`, e `estagnDeal` apenas `PIPELINES.ESTAGNADOS` (já é assim)
- Deals em outros pipelines (Distribuidor, Ebook, etc.) devem ser ignorados para fins de decisão, permitindo a criação de um deal novo

Olhando o código atual (linha 1125-1130):
```
vendaDeal = openDeals.find(d => Number(d.pipeline_id) === PIPELINES.VENDAS && !d.freezed);
estagnDeal = openDeals.find(d => Number(d.pipeline_id) === PIPELINES.ESTAGNADOS);
```
Isso já está correto — só filtra Vendas e Estagnados. O deal do "Distribuidor de Leads" (70898) **não deveria** ser encontrado como `vendaDeal`.

**Revisão**: O problema pode estar na `findPersonByEmail` → o lead já tinha `pessoa_piperun_id` cacheado, e o deal 25658331 é encontrado no cascade pelo `piperun_id`. O `lia-assign` após criar/atualizar person vai buscar deals e como não acha deal aberto em Vendas nem Estagnados, **deveria ter criado um novo deal**. Mas o `piperun_id` no lead ainda aponta para o antigo.

Preciso verificar se o `lia-assign` realmente executou com sucesso para esta submissão. Os logs de WhatsApp confirmam que sim. Então o deal **pode ter sido criado** mas o `piperun_id` não foi atualizado corretamente.

#### 3. Verificar deal no PipeRun
- Testar chamando `lia-assign` diretamente com `force: true` para o lead e verificar o resultado
- Isso nos dirá exatamente qual flow foi executado e se um deal novo foi criado

### Ações técnicas

1. **Migration SQL**: Corrigir nome do lead para "Danilo Henrique"
2. **Teste direto**: Chamar `lia-assign` com `force: true` e `email: danilohen@gmail.com` para ver o resultado completo (flow type, piperun_id retornado)
3. **Se necessário**: Ajustar a lógica para que deals em pipelines "passivos" (Distribuidor, Ebook) sejam tratados como "sem deal ativo", permitindo criação de um novo deal em Vendas

