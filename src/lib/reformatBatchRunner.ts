import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BatchTarget {
  id: string;
  title: string;
}

export interface BatchState {
  running: boolean;
  force: boolean;
  done: number;
  total: number;
  ok: number;
  skipped: number;
  err: number;
  log: string[];
  currentTitle: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  dismissed: boolean;
}

const initial: BatchState = {
  running: false,
  force: false,
  done: 0,
  total: 0,
  ok: 0,
  skipped: 0,
  err: 0,
  log: [],
  currentTitle: null,
  startedAt: null,
  finishedAt: null,
  dismissed: false,
};

let state: BatchState = { ...initial };
const listeners = new Set<() => void>();
let cancelFlag = false;

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<BatchState>) {
  state = { ...state, ...patch };
  emit();
}

function pushLog(line: string) {
  state = { ...state, log: [line, ...state.log].slice(0, 100) };
  emit();
}

// Warn user if they try to close the tab while the batch is running.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (state.running) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

export const reformatBatch = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  cancel() {
    if (state.running) cancelFlag = true;
  },
  dismiss() {
    if (!state.running) set({ dismissed: true });
  },
  reset() {
    if (!state.running) {
      state = { ...initial };
      emit();
    }
  },
  async start(targets: BatchTarget[], force: boolean, onDone?: () => void) {
    if (state.running) return;
    cancelFlag = false;
    state = {
      ...initial,
      running: true,
      force,
      total: targets.length,
      startedAt: Date.now(),
    };
    emit();

    let ok = 0;
    let skipped = 0;
    let err = 0;

    for (let i = 0; i < targets.length; i++) {
      if (cancelFlag) {
        pushLog(`⛔ Cancelado em ${i}/${targets.length}`);
        break;
      }
      const a = targets[i];
      set({ currentTitle: a.title });
      try {
        const { data, error } = await supabase.functions.invoke('reformat-article-html', {
          body: { contentId: a.id, previewOnly: false, force },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'unknown');
        if (data.skipped) {
          skipped++;
          pushLog(`⏭️  ${a.title} (já reformatado)`);
        } else {
          ok++;
          pushLog(`✅ ${a.title}`);
        }
      } catch (e: any) {
        err++;
        pushLog(`❌ ${a.title}: ${e?.message || e}`);
      }
      set({ done: i + 1, ok, skipped, err });
    }

    set({ running: false, currentTitle: null, finishedAt: Date.now() });
    onDone?.();
  },
};

export function useReformatBatchState(): BatchState {
  return useSyncExternalStore(
    (l) => reformatBatch.subscribe(l),
    () => state,
    () => state,
  );
}