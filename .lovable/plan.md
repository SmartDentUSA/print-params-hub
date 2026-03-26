

# Plan: Countdown states for presencial courses

## Current behavior
The `useCountdown` hook returns either a `"Xd Xh Xm"` string or `"Encerrado"` based solely on whether `start_date` has passed. No nuance for enrollment windows or ongoing events.

## New business rules (presencial only)

| Phase | Condition | Display | Badge style |
|---|---|---|---|
| Inscrições abertas | > 7 days before start | `Inscrições abertas` | green |
| Encerramento próximo | 4–7 days before start | `Faltam X dias para encerrar inscrições` | amber |
| Inscrições encerradas | 1–3 days before start | `Inscrições encerradas` | red/secondary |
| Acontecendo agora | between start datetime and end datetime | `Acontecendo agora` | blue pulse |
| Curso realizado | after end datetime | `Curso realizado` | secondary/muted |

## Changes

**File: `src/components/SmartOpsCourses.tsx`**

### 1. Refactor `useCountdown` to return a richer object

Replace the current hook (lines 34-51) with a version that returns `{ label, style, daysUntilStart }`:

```ts
type CountdownResult = {
  label: string;
  variant: 'green' | 'amber' | 'red' | 'blue' | 'muted';
} | null;

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { /* same 60s interval */ }, []);

  return (startDate?: string, startTime?: string, endDate?: string, endTime?: string, modality?: string): CountdownResult => {
    if (!startDate) return null;
    const sTime = startTime?.substring(0,5) ?? '09:00';
    const eDate = endDate ?? startDate;
    const eTime = endTime?.substring(0,5) ?? '18:00';
    const startMs = new Date(`${startDate}T${sTime}:00`).getTime();
    const endMs   = new Date(`${eDate}T${eTime}:00`).getTime();
    const diffStart = startMs - now;
    const daysUntil = Math.ceil(diffStart / 86400000);

    // After end → Curso realizado
    if (now >= endMs) return { label: 'Curso realizado', variant: 'muted' };
    // During event → Acontecendo agora
    if (now >= startMs) return { label: 'Acontecendo agora', variant: 'blue' };

    // Presencial-specific enrollment phases
    if (modality === 'presencial') {
      if (daysUntil <= 3) return { label: 'Inscrições encerradas', variant: 'red' };
      if (daysUntil <= 7) return { label: `Faltam ${daysUntil} dias para encerrar inscrições`, variant: 'amber' };
      return { label: 'Inscrições abertas', variant: 'green' };
    }

    // Online/other: keep numeric countdown
    const d = Math.floor(diffStart / 86400000);
    const h = Math.floor((diffStart % 86400000) / 3600000);
    const m = Math.floor((diffStart % 3600000) / 60000);
    return { label: `${d}d ${h}h ${m}m`, variant: 'green' };
  };
}
```

### 2. Update rendering (lines 195-229)

Pass `turma.end_date`, `turma.end_time`, and `course.modality` to `getCountdown`. Replace the Badge rendering to use `countdown.variant` for colors and `countdown.label` for text. Map variants to Tailwind classes:

- `green` → `bg-green-100 text-green-800`
- `amber` → `bg-amber-100 text-amber-800`
- `red` → `bg-red-100 text-red-800`
- `blue` → `bg-blue-100 text-blue-800 animate-pulse`
- `muted` → default secondary badge

Update `isEncerrado` check to `countdown?.variant === 'muted'` for the row opacity.

### 3. Disable enrollment button when inscriptions closed

When variant is `'red'` or `'muted'`, disable the "Inscrever" button for presencial courses.

**Single file modified:** `src/components/SmartOpsCourses.tsx`

