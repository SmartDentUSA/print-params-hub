---
name: piperun-customfields-resilience
description: mapAttendanceToDealCustomFields fallback to form_data + backfill edge function
type: feature
---
**Mapper Fallback (`_shared/piperun-field-map.ts`)**: `mapAttendanceToDealCustomFields` resolves each canonical field (`especialidade`, `produto_interesse`, `area_atuacao`, `tem_scanner`, `tem_impressora`, `pais_origem`) by first reading the top-level column, then scanning recursively into `form_data` JSONB (any form key, any `raw_fields`/`responses`) using a synonym table. Prevents race conditions where lia-assign runs before dynamic-lead-ingestion promotes form_data values to top-level columns. Area values in ALL CAPS are normalized to Title Case.

**Backfill Edge `smart-ops-piperun-backfill-customfields`**: POST `{ dry_run, lead_ids?, since?, limit? }`. Scans canonical leads (`merged_into IS NULL`, `piperun_id NOT NULL`) where `piperun_custom_fields` is empty/null, rebuilds custom_fields via mapper, PUTs `deals/{piperun_id}` with hash map, mirrors result to `lia_attendances.piperun_custom_fields`. Default since = 90 days, default limit = 500, default `dry_run = true`. 120ms throttle between PUTs.
