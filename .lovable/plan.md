## Objetivo
Atribuir a cada turma um **número sequencial por modalidade**, gerado automaticamente quando a turma é criada (manual, clonagem ou recorrência). Exibir esse número na interface.

## Regras
- **Presencial**: o próximo turma criada = **140** (138 e 139 são as turmas já existentes — não serão renumeradas; ficarão sem número até edição manual, se desejado).
- **Online**: começa em **001** e segue 002, 003…
- **Online ao Vivo**: começa em **001** (contador independente de "Online").
- O número é atribuído **na criação** da turma e nunca muda depois.

## Estratégia técnica

### 1. Migration: nova coluna + tabela de contadores + trigger

**Schema**
```sql
-- 1.1 Coluna na turma
ALTER TABLE smartops_course_turmas
  ADD COLUMN turma_number int;

CREATE INDEX idx_turmas_number_modality
  ON smartops_course_turmas (turma_number);

-- 1.2 Tabela de contadores por modalidade
CREATE TABLE smartops_turma_counters (
  modality text PRIMARY KEY,         -- 'presencial' | 'online' | 'online_ao_vivo'
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Seeds (próximo presencial = 140; online/online_ao_vivo começam em 001)
INSERT INTO smartops_turma_counters (modality, last_number) VALUES
  ('presencial', 139),
  ('online', 0),
  ('online_ao_vivo', 0)
ON CONFLICT (modality) DO NOTHING;
```

**Trigger BEFORE INSERT em `smartops_course_turmas`**
```sql
CREATE OR REPLACE FUNCTION public.fn_assign_turma_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_modality text;
  v_next int;
BEGIN
  IF NEW.turma_number IS NOT NULL THEN RETURN NEW; END IF;

  SELECT modality INTO v_modality FROM smartops_courses WHERE id = NEW.course_id;
  IF v_modality IS NULL THEN RETURN NEW; END IF;

  -- Lock + increment atômico
  UPDATE smartops_turma_counters
     SET last_number = last_number + 1, updated_at = now()
   WHERE modality = v_modality
  RETURNING last_number INTO v_next;

  -- Bucket não existia (modalidade nova): cria com 1
  IF v_next IS NULL THEN
    INSERT INTO smartops_turma_counters (modality, last_number) VALUES (v_modality, 1)
    RETURNING last_number INTO v_next;
  END IF;

  NEW.turma_number := v_next;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_turma_number
BEFORE INSERT ON smartops_course_turmas
FOR EACH ROW EXECUTE FUNCTION public.fn_assign_turma_number();
```

A trigger cobre automaticamente todos os caminhos de criação (modal de criar curso, clone, recorrência cron). **Nenhuma alteração no código de inserção** é necessária.

### 2. Helper de formatação no frontend
Criar `src/lib/turmaNumber.ts`:
```ts
export function formatTurmaNumber(n: number | null | undefined, modality?: string): string | null {
  if (!n) return null;
  // Presencial usa número natural (140); Online usa zero-pad 3 dígitos (001)
  if (modality === 'presencial') return `#${n}`;
  return `#${String(n).padStart(3, '0')}`;
}
```

### 3. Exibição na UI
Adicionar a marca do número ao lado do label da turma em:
- **`src/components/smartops/TurmaCard.tsx`** — header (no topo do card, antes ou ao lado de `turma.label`).
- **`src/components/smartops/CourseCreateModal.tsx`** — lista de turmas existentes (linha `{t.label}` por volta da L596).
- **`src/components/SmartOpsCourses.tsx`** — aba Inscrições, coluna Turma (`enrollment.turma?.label`) — anexar `#NNN`.
- **`src/components/smartops/EnrollmentModal.tsx`** — texto da turma selecionada.

Em todos os pontos, buscar `turma_number` no SELECT (adicionar a coluna onde já se pede `label`).

### 4. Não alterar
- Edge functions de geração de doc/crachá/certificado/comprovante (não dependem do número agora; se quiser exibir lá, é outro passo).
- Lógica de inscrição, RLS, recorrência — só a coluna nova entra junto.

## Arquivos
- **Migration**: nova (coluna, tabela, trigger, seeds).
- **Editado**: `src/lib/turmaNumber.ts` (criar), `TurmaCard.tsx`, `CourseCreateModal.tsx`, `SmartOpsCourses.tsx` (SELECT + render), `EnrollmentModal.tsx`.

## Validação
- Criar uma turma Presencial → `turma_number = 140`. Criar outra → 141.
- Criar Online → 001. Criar Online ao Vivo → 001 (independente).
- Clonar turma Presencial (via "Repetir turma") → ganha próximo número (142, 143…).
- Reabrir cards e ver "#140 — Turma 18/06 a 20/06".
