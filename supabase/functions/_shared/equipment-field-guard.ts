// Guard for equipment label fields. Mirror of src/utils/equipmentLabel.ts.
// Rejects long marketing descriptions leaking from PipeRun custom fields into
// equip_scanner, equip_impressora, equip_pos_impressao, equip_cad,
// equip_fresadora, equip_notebook.

const MARKETING_TOKENS_RE =
  /(opalescente|glaze|mantenha por|cura final|luz uv|luz led|min(?:uto)?s? por fase|sob luz)/i;

// ── Encoding repair ──────────────────────────────────────────────────────────
// Textos vindos do PipeRun (custom field itens_proposta) chegam ora em
// mojibake UTF-8→Latin1 ("BÃ¡sico"), ora já com bytes perdidos substituídos
// pelo replacement char U+FFFD ("B\uFFFDsico"). O primeiro caso é 100%
// reversível; o segundo só é recuperável por dicionário de padrões conhecidos.

const MOJIBAKE_RE = /Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â€/;

const FFFD_DICTIONARY: Array<[RegExp, string]> = [
  [/B\uFFFDsico/gi, "Básico"],
  [/L\uFFFDtio/gi, "Lítio"],
  [/Licen\uFFFDa/gi, "Licença"],
  [/PADR\uFFFDO/g, "PADRÃO"],
  [/APLICA\uFFFD\uFFFDO/g, "APLICAÇÃO"],
  [/Impress\uFFFDo/gi, "Impressão"],
  [/Pr\uFFFD/g, "Pré"],
  [/Pr\uFFFDtese/gi, "Prótese"],
  [/Resfri\uFFFDmento/gi, "Resfriamento"],
];

export function repairEncoding(value: string): string {
  let s = value;
  if (MOJIBAKE_RE.test(s)) {
    try {
      const bytes = Uint8Array.from([...s].map((ch) => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (!decoded.includes("\uFFFD")) s = decoded;
    } catch { /* keep original */ }
  }
  for (const [re, replacement] of FFFD_DICTIONARY) s = s.replace(re, replacement);
  return s;
}

export function hasUnrecoverableEncoding(value: string): boolean {
  return value.includes("\uFFFD");
}

export function isValidEquipmentLabel(value: unknown): boolean {
  if (value == null) return false;
  const s = repairEncoding(String(value).trim());
  if (!s) return false;
  if (s.length > 80) return false;
  if (/\r|\n/.test(s)) return false;
  if (s.includes("!!!")) return false;
  // Bytes perdidos que o dicionário não recuperou: não persistir lixo.
  if (hasUnrecoverableEncoding(s)) return false;
  if (MARKETING_TOKENS_RE.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  return true;
}

export function sanitizeEquipmentLabel(value: unknown): string | null {
  return isValidEquipmentLabel(value) ? repairEncoding(String(value).trim()) : null;
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