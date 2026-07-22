## Auditoria — 109 leads Meta (BLZ + Impressoras + Vitality) × Funil

### Resultado
| Métrica | Qtd |
|---|---|
| Total nos CSVs (emails únicos) | **109** |
| Presentes em `lia_attendances` | 97 |
| Com **Person** no PipeRun (`pessoa_piperun_id`) | 95 |
| Com **Deal** no PipeRun (`piperun_id`) | **95** |
| **Faltando no banco (nem email nem telefone)** | **12** |
| No lia mas sem deal (merged/legado) | 2 |

### 12 leads ausentes (não entraram no funil)
Nenhum encontrado por email nem por telefone em `lia_attendances`.

| CSV | Nome | Email | Telefone | created_time |
|---|---|---|---|---|
| BLZ | Kleverson | kevomoura@gmail.com | 5554991649504 | 22/07 03:13 |
| BLZ | Eduardo Junqueira | jlodontoltda@gmail.com | 5511980493996 | 22/07 01:29 |
| BLZ | Leonardo Marques | drleo.marques@hotmail.com | 11950549799 | 22/07 01:20 |
| BLZ | Andre Silva | joseandredasilva2@gmail.com | 5535988952079 | 22/07 00:45 |
| BLZ | Patrick Campos | patrick-sex@hotmail.com | 5534992468016 | 21/07 23:51 |
| BLZ | Dr. Murilo Ribeiro | drmuriloribeiri@outlook.com | 5586981496931 | 21/07 14:52 |
| BLZ | Diogo Matozo | dimatozo@gmail.com | 5511952484944 | 21/07 09:50 |
| BLZ | Theo Sá | treboucasdesa@gmail.com | 558981463582 | 21/07 03:26 |
| Impressoras | Rogerio Rodrigues | rogeriorodrygues@gmail.com | 5585992046810 | 22/07 01:51 |
| Impressoras | Vivian Faria | vivianmcfaria@gmail.com | 5512982218231 | 22/07 00:58 |
| Vitality | murilo goulart | nevackjuliana@gmail.com | 5518997780797 | 22/07 01:17 |
| Vitality | Dr Fernando Cardoso | fcardosoalmeida@bol.com.br | 5527981126146 | 21/07 23:46 |

### 2 casos merged/sem deal (revisar depois, fora do backfill)
- `sdpp@smartdent.com.br` (Danilo/interno) — lead merged, sem novo deal.
- `drmariaritas@gmail.com` — merged em lead com "Proposta Enviada"; possível colisão.

### Ação
Rodar `meta-lead-ads-backfill` para os 3 form IDs (BLZ, Impressoras, Vitality) cobrindo janela **21/07 00:00 → 22/07 06:00 UTC** — mesmo procedimento usado nas auditorias anteriores. O ingestor aplica taxonomia (área, scanner, impressora, produto de interesse), roda `lia-assign` e cria Deal quando `form_name` está whitelistado.

### Passos
1. Invocar `meta-lead-ads-backfill` com `{ since: "2026-07-21T00:00:00Z", until: "2026-07-22T06:00:00Z", form_names: ["BLZ","Impresoras","Vitality"] }` (params reais conforme função).
2. Aguardar `lia-assign` completar (30-60s).
3. Re-executar a mesma query de auditoria por email nos 12 alvos.
4. Reportar: quantos foram ingeridos, quantos ganharam Person+Deal, e listar remanescentes com motivo (`crm_creation_blocked`, faltando identificadores, etc.).
5. Para os 2 casos merged: apenas reportar — não desmergear sem instrução.

### Fora do escopo
- Nenhuma migração de schema.
- Nenhum ajuste no ingestor Meta (já elevado para `since_minutes=30` + gap detector).
- Nenhuma alteração em UI.
