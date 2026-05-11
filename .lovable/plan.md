## Plano

### Parte 1 — Backfill `equip_*` a partir de Piperun deal_items (fonte primária)

Edge function nova `smart-ops-backfill-equipment-from-deals`:

**Input:** todos os leads canônicos (`merged_into IS NULL`) que tenham `deal_items` com `source='piperun'` (1.792 leads).

**Lógica de classificação (regex sobre `product_name`, case-insensitive):**

| Categoria | Padrão | Campos preenchidos |
|---|---|---|
| **Scanner intraoral** | `medit\s*i\d|i600|i700|aoralscan|trios|itero|primescan|scanner intraoral` | `equip_scanner` = nome canônico, `tem_scanner=true`, `status_scanner='tem_smartdent'` se vendido por nós |
| **Impressora 3D** | `halot|elegoo|mars|saturn|miicraft|phrozen|sonic|anycubic|rayshape|edgemini|impressora` | `equip_impressora` = modelo, `impressora_modelo` = modelo, `tem_impressora=true`, `status_impressora='tem_smartdent'` |
| **Cura/Wash** | `wash.?cure|mercury|nanoclean pod|cure m\d` | `equip_pos_cura` (se existir o campo), senão badge auxiliar |
| **CAD/CAM Software** | `exocad|exoplan|dentalcad|meshmixer|3shape design` | `software_cad` = nome, `equip_cad`, `status_cad='tem_exocad'` quando exocad |
| **Notebook/Workstation** | `notebook|avell|workstation|ryzen|rtx` | `equip_workstation` (auxiliar) |

Resinas, kits, treinamentos e cursos são **ignorados** (não são equipamentos).

**Estratégia de aplicação (incremental + auditável):**
1. Para cada lead, agregar todos os itens ganhos.
2. Para cada categoria detectada, **só preencher se o campo está vazio ou contém "Não"** (respeitando dado já enriquecido pelo SDR/form 7×3).
3. `equip_*_idade_meses` = meses desde `closed_at` do deal de origem.
4. Inserir registro em `lead_enrichment_audit` com `source='backfill_equipment_from_deals'`.
5. Lotes de 200, idempotente (rerun não duplica).

**Trigger:** disparado manualmente pela aba Smart Ops > Sync (botão "Backfill Equipamentos via Deals Ganhos") ou via curl.

### Parte 2 — Parte do Omie (apenas verificação cruzada)

**Não usar Omie para backfill enquanto os campos `omie_total_pedidos / omie_ultima_compra` estiverem zerados** — provavelmente o sync atual só atualiza timestamp sem hidratar contas. 

Criar script de auditoria separado (`smart-ops-audit-omie-vs-piperun`) que apenas reporta divergências:
- Leads com `omie_last_sync` recente mas `omie_total_pedidos=0`
- Leads com `deal_items piperun ganho` sem espelho em Omie
- Saída: tabela `lead_enrichment_audit` com `source='omie_audit'` e `note='omie_empty_despite_sync'`

Esse relatório não corrige nada — só diagnostica para uma rodada futura de fix do `omie-sync`.

### Parte 3 — Refresh dos contadores Copilot

Após backfill, rodar query de validação:
```sql
SELECT 
  COUNT(*) FILTER (WHERE equip_scanner IS NOT NULL AND equip_scanner !~* '^n[ãa]o') AS com_scanner,
  COUNT(*) FILTER (WHERE equip_impressora IS NOT NULL OR impressora_modelo IS NOT NULL) AS com_impressora,
  COUNT(*) FILTER (WHERE software_cad IS NOT NULL) AS com_cad
FROM lia_attendances WHERE merged_into IS NULL;
```

Esperado: subir de **455 → ~1.500+ scanners**, **500 → ~1.700+ impressoras**, **5 → ~50+ CAD**.

---

### Fora de escopo
- **Não tocar** no `omie-sync` agora (precisa investigação separada — provavelmente bug de mapeamento campo).
- **Não sobrescrever** valores que vieram do form 7×3/SDR (são mais recentes/precisos).
- **Não criar** nova categoria taxonômica — usar campos que já existem em `lia_attendances`.

### Validação final
- Conferir 5 leads-amostra com Halot, Medit i600 e Exocad — devem aparecer com badges corretos no Lead Card.
- Conferir 3 leads que tinham equipamento via SDR (não-deal) — não podem ter sido sobrescritos.
- Copilot deve responder "quantos clientes têm Halot One Pro" com número >100.
