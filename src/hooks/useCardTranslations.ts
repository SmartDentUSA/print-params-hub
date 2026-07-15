import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// In-memory dedupe across components/renders.
const inflight = new Map<string, Promise<void>>();

type CacheEntry = {
  sourceSignature: string;
  values: Record<string, unknown>;
};

const sourceSignature = (row: TranslatedRow, fields: string[]) =>
  JSON.stringify(fields.map((field) => (row as any)[field] ?? null));

export type TranslatedRow = Record<string, unknown> & { id: string };

/**
 * On-demand card translator.
 * - When language === 'pt', returns rows untouched.
 * - When language is 'en' or 'es', merges existing `<field>_<lang>` columns into the row
 *   (under the original field names) and asynchronously triggers translation for any
 *   row missing translations. Once translations arrive, returns refreshed rows.
 *
 * The rows passed in MUST include `id` and both the PT field and `<field>_<lang>` columns.
 */
export function useCardTranslations<T extends TranslatedRow>(
  table: string,
  rows: T[] | null | undefined,
  fields: string[]
): T[] {
  const { language } = useLanguage();
  const lang = language === 'en' || language === 'es' ? language : null;
  const [version, setVersion] = useState(0);
  const cache = useRef(new Map<string, CacheEntry>());

  // Trigger translations for rows missing any field in the target lang.
  useEffect(() => {
    if (!lang || !rows || rows.length === 0) return;
    const targets = rows.filter((r) =>
      fields.some((f) => {
        const ptVal = (r as any)[f];
        const trVal = (r as any)[`${f}_${lang}`];
        const cachedEntry = cache.current.get(`${r.id}|${lang}`);
        const cached = cachedEntry?.sourceSignature === sourceSignature(r, fields)
          ? cachedEntry.values[f]
          : undefined;
        const hasPt = ptVal != null && (typeof ptVal === 'string' ? ptVal.trim() !== '' : true);
        return hasPt && (trVal == null || trVal === '') && cached == null;
      })
    );
    if (targets.length === 0) return;

    targets.forEach((r) => {
      const key = `${table}|${r.id}|${lang}`;
      if (inflight.has(key)) return;
      const p = (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('translate-card-row', {
            body: { table, id: r.id, target: lang },
          });
          if (error) {
            console.warn('[useCardTranslations]', table, r.id, lang, error.message);
            return;
          }
          if (data?.ok) {
            // Refetch translated columns for this row.
            const cols = ['id', ...fields.map((f) => `${f}_${lang}`)].join(',');
            const { data: fresh } = await supabase
              .from(table as any)
              .select(cols)
              .eq('id', r.id)
              .maybeSingle();
            if (fresh) {
              const merged: Record<string, unknown> = {};
              for (const f of fields) {
                const v = (fresh as any)[`${f}_${lang}`];
                if (v != null && v !== '') merged[f] = v;
              }
              cache.current.set(`${r.id}|${lang}`, {
                sourceSignature: sourceSignature(r, fields),
                values: merged,
              });
              setVersion((v) => v + 1);
            }
          }
        } catch (e) {
          console.warn('[useCardTranslations] failed', e);
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, p);
    });
  }, [table, rows, fields.join('|'), lang]);

  // Merge translations into rows for rendering.
  return useMemo(() => {
    if (!rows) return [] as T[];
    if (!lang) return rows;
    return rows.map((r) => {
      const out: any = { ...r };
      for (const f of fields) {
        const trCol = (r as any)[`${f}_${lang}`];
        const cachedEntry = cache.current.get(`${r.id}|${lang}`);
        const cached = cachedEntry?.sourceSignature === sourceSignature(r, fields)
          ? cachedEntry.values[f]
          : undefined;
        const v = trCol != null && trCol !== '' ? trCol : cached;
        if (v != null && v !== '') {
          out[f] = v;
          // Mirror to `<f>_<lang>` so consumers that read the translated column
          // directly (e.g. KbTabCatalogo rawSpecs → technical_specs_en) pick up
          // the just-fetched translation without needing a parent refetch.
          out[`${f}_${lang}`] = v;
        }
      }
      return out as T;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lang, version, fields.join('|')]);
}