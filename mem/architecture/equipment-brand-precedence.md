---
name: Equipment Brand Precedence
description: Marca/modelo do formulário sempre vence resposta genérica sim/não na canonicalização de impressora e scanner
type: feature
---
Em `smart-ops-ingest-lead`, `impressora_modelo`/`scanner_marca` (marca real, ex.: ANYCUBIC, 3Shape) têm prioridade sobre `tem_impressora`/`como_digitaliza` quando estes são genéricos (`sim`, `não`, `tenho`...). Caso contrário a marca virava "OUTRAS"/"OUTROS" e chegava assim no PipeRun (CF pessoa 772728 impressora / 772727 scanner).
`canonicalizeScanner` reconhece 3Shape/Trios.
