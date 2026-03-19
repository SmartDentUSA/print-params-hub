

# Diagnóstico: Sync de pipelines grandes está excedendo o timeout

## O que já funcionou
Os pipelines menores foram atualizados com sucesso pelo sync com o builder rico:
- **Pipeline 72938** (Estagnados): 377 leads atualizados
- **Pipeline 70898**: 184 leads atualizados
- **Pipeline 73999**: 548 deals processados

## O que NÃO funcionou
Os pipelines grandes (**18784** Vendas e **83896** CS Onboarding) possuem **5000+ deals cada**. A edge function excede o timeout (60s) antes de processar todos. O deal 56186037 (R$26k, RayShape Edge Mini, PRO18302) do lead `ciclistadejaleco@gmail.com` está no pipeline 83896 e não foi alcançado antes do timeout - por isso `proposals: []` permanece.

## Solução: Adicionar chunking ao sync

### Arquivo: `supabase/functions/smart-ops-sync-piperun/index.ts`

Adicionar dois parâmetros: `offset` e `chunk_size` (default 500).

- Quando chamado com `?full=true&pipeline_id=83896&offset=0&chunk_size=500`, processa apenas os deals 0-499
- O modo `orchestrate` passa a dividir pipelines grandes em chunks automaticamente
- Cada chunk cabe no timeout de 60s

### Mudança no orchestrador (mesmo arquivo)
```
Para cada pipeline:
  1. Busca total de deals na API PipeRun
  2. Se total > 500, divide em chunks de 500
  3. Chama self com offset=0, offset=500, offset=1000... sequencialmente
```

### Resultado esperado
- O sync completo de TODOS os pipelines passa a funcionar sem timeout
- O deal 56186037 será processado e seu `proposals[]` será preenchido com os itens reais (RayShape Edge Mini, PRO18302)
- Todos os leads dos pipelines grandes (Vendas, CS Onboarding) terão seus cards atualizados com vendedor, proposta e SKU corretos

### Sem alteração em nenhum outro arquivo
- Sem mudança no frontend
- Sem mudança no schema do banco
- Sem mudança em nenhum outro edge function

