

# Plan: AlertDialog safety check + recurrenceBaseDate on edit

## Overview
Two targeted fixes in `src/components/smartops/CourseCreateModal.tsx`.

## Fix 1 — AlertDialog before recreating enrolled sessions

**Current behavior (lines 476-490):** The RPC `fn_generate_recurrent_turmas` is called directly without checking for existing sessions with enrollees.

**Changes:**
1. Add two states: `showRecreateConfirm` (boolean) and `enrolledSessionsCount` (number)
2. Extract lines 478-489 into a standalone `executeRecurrenceGeneration(courseId)` async function
3. In `handleSave`, before calling the RPC (line 477), if `isEdit`:
   - Query `smartops_course_turmas` for `course_id = courseId`, `recurrence_parent_id IS NOT NULL`, `enrolled_count > 0` with `count: 'exact', head: true`
   - If count > 0: set states, show AlertDialog, `return` (pause save)
   - If count = 0: call `executeRecurrenceGeneration` directly
4. Add AlertDialog JSX at component bottom with "Cancelar" and "Continuar" buttons. "Continuar" calls `executeRecurrenceGeneration`.

## Fix 2 — Populate recurrenceBaseDate when editing

**Current behavior (line 248):** The useEffect loads all recurrence fields except `recurrenceBaseDate`.

**Change:** After `loadTurmas(course.id)` call (line 250), if `course.recurrence_enabled`:
- Query `smartops_course_turmas` with `course_id`, ordered by `recurrence_index asc`, limit 1, selecting `days:smartops_turma_days(date)`
- Extract the earliest date from the first turma's days
- Call `setRecurrenceBaseDate(firstDate)`

## Files modified
- `src/components/smartops/CourseCreateModal.tsx` only

