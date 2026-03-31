

# Add Per-Lead "Sync PipeRun" Button to Lead Detail Panels

## Problem
There is no individual sync button on the lead card/detail UI. The only sync exists at the SmartOps top level and syncs ALL leads. The user needs a per-lead button to re-fetch a specific lead's data from PipeRun.

## Solution
Add a "🔄 Sync PipeRun" button to both lead detail views (Intelligence panel + Kanban sheet) that calls `backfill-deal-proposals` with the lead's `piperun_id` to re-fetch deals + proposals for that specific lead.

## Changes

### 1. `src/components/smartops/LeadDetailPanel.tsx`
- Add a "🔄 Sync" button in the hero section (next to the close button or in the action bar)
- On click: call `smart-ops-sync-piperun` with `{ person_id: lead.piperun_person_id }` or `backfill-deal-proposals` with `{ deal_ids: [...] }`
- Show loading state + toast on success/error
- After success, re-fetch the detail data

### 2. `src/components/smartops/KanbanLeadDetail.tsx`
- Add the same sync button in the Sheet header area
- Same logic: invoke edge function for the specific lead, then refresh

### Technical Details
- Both components already have access to `lead.piperun_id` and the API_BASE constant
- Will use `supabase.functions.invoke("backfill-deal-proposals", { body: { deal_ids: [lead.piperun_id] } })` pattern
- Loading state via local `useState`
- Toast feedback via `sonner`

