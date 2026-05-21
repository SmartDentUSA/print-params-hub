import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProvenanceKind = "venda" | "declarado" | "desconhecido";

export interface ProvenanceEntry {
  kind: ProvenanceKind;
  source: string | null;
  formName: string | null;
  timestamp: string | null;
}

const FIELDS = [
  "equip_scanner",
  "equip_scanner_bancada",
  "equip_impressora",
  "impressora_modelo",
  "equip_pos_impressao",
  "equip_cad",
  "software_cad",
  "equip_notebook",
  "equip_fresadora",
] as const;

export type EquipmentField = (typeof FIELDS)[number];

function classifySource(source: string | null): ProvenanceKind {
  if (!source) return "desconhecido";
  const s = source.toLowerCase();
  if (
    s.includes("backfill_equipment_from_deals") ||
    s.includes("piperun_deal_items") ||
    s.includes("piperun_deals") ||
    s.includes("omie")
  ) {
    return "venda";
  }
  if (
    s === "form" ||
    s.includes("sdr_captacao") ||
    s.includes("astron") ||
    s.includes("ingest") ||
    s.includes("sellflux") ||
    s.includes("public_form")
  ) {
    return "declarado";
  }
  return "desconhecido";
}

/**
 * Fetches the most recent `lead_enrichment_audit` entry for each equipment
 * field on a lead, so the UI can tell the user whether the equipment was
 * **declared by the lead in a form** or **detected from a Smart Dent sale**.
 */
export function useEquipmentProvenance(leadId: string | null | undefined) {
  const [map, setMap] = useState<Partial<Record<EquipmentField, ProvenanceEntry>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setMap({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("lead_enrichment_audit")
        .select("source,fields_updated,new_values,timestamp")
        .eq("lead_id", leadId)
        .order("timestamp", { ascending: false })
        .limit(80);

      if (cancelled) return;
      if (error || !data) {
        setMap({});
        setLoading(false);
        return;
      }

      const next: Partial<Record<EquipmentField, ProvenanceEntry>> = {};
      for (const row of data as Array<{
        source: string | null;
        fields_updated: string[] | null;
        new_values: Record<string, unknown> | null;
        timestamp: string | null;
      }>) {
        const fields = Array.isArray(row.fields_updated) ? row.fields_updated : [];
        const formName =
          (row.new_values?.form_name as string | undefined) ?? null;
        for (const f of fields) {
          if (!FIELDS.includes(f as EquipmentField)) continue;
          const key = f as EquipmentField;
          if (next[key]) continue; // already have most recent (sorted desc)
          next[key] = {
            kind: classifySource(row.source),
            source: row.source,
            formName,
            timestamp: row.timestamp,
          };
        }
      }
      setMap(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return { provenance: map, loading };
}
