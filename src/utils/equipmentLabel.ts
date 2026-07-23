// Guard for equipment label fields (equip_scanner, equip_impressora, equip_pos_impressao,
// equip_cad, equip_fresadora, equip_notebook). PipeRun custom fields occasionally leak
// marketing descriptions ("ÚNICO GLAZE OPALESCENTE DO MUNDO!!!...") into these columns.
// Reject anything that clearly is not a short model/product name.

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