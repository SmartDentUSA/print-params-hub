// Guard for equipment label fields. Mirror of src/utils/equipmentLabel.ts.
// Rejects long marketing descriptions leaking from PipeRun custom fields into
// equip_scanner, equip_impressora, equip_pos_impressao, equip_cad,
// equip_fresadora, equip_notebook.

const MARKETING_TOKENS_RE =
  /(opalescente|glaze|mantenha por|cura final|luz uv|luz led|min(?:uto)?s? por fase|sob luz)/i;

export function isValidEquipmentLabel(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (s.length > 80) return false;
  if (/\r|\n/.test(s)) return false;
  if (s.includes("!!!")) return false;
  if (MARKETING_TOKENS_RE.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  return true;
}

export function sanitizeEquipmentLabel(value: unknown): string | null {
  return isValidEquipmentLabel(value) ? String(value).trim() : null;
}

export const EQUIP_LABEL_COLUMNS = [
  "equip_scanner",
  "equip_scanner_bancada",
  "equip_impressora",
  "equip_pos_impressao",
  "equip_cad",
  "equip_fresadora",
  "equip_notebook",
] as const;

/**
 * Drop any equip_* label from a partial lia_attendances update payload that
 * is not a valid short equipment label. Serial columns are left intact.
 */
export function stripInvalidEquipmentLabels<T extends Record<string, unknown>>(
  payload: T,
): { payload: T; rejected: string[] } {
  const rejected: string[] = [];
  for (const col of EQUIP_LABEL_COLUMNS) {
    if (!(col in payload)) continue;
    const v = (payload as any)[col];
    if (v == null) continue;
    if (!isValidEquipmentLabel(v)) {
      rejected.push(col);
      delete (payload as any)[col];
    }
  }
  return { payload, rejected };
}