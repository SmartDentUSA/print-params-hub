export interface ResinShade { label: string; code: string; tone: string }

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]/g, ' ');

/** Availability comes only from registered variants, never from a default shade list. */
export function catalogResinShades(colors: string[], productName: string): ResinShade[] {
  const family = /\bht\b/i.test(productName) ? 'ht' : /\bclassic\b/i.test(productName) ? 'classic' : null;
  const shades = new Map<string, ResinShade>();
  for (const color of colors) {
    const entries = color.match(/(?:BL\d+|[ABCD]\d(?:\.\d+)?)\s*(?:Classic|HT)?\b/gi) || color.split(/[,;|/]+/);
    for (const entry of entries) {
      const label = entry.trim();
      if (!label) continue;
      const variantFamily = /\bht\b/i.test(label) ? 'ht' : /\bclassic\b/i.test(label) ? 'classic' : null;
      if (family && variantFamily && variantFamily !== family) continue;
      const base = normalized(label).replace(/\b(classic|ht)\b/g, '').trim();
      const codes: Record<string, [string, string]> = {
        a2: ['A2', 'a2'], a3: ['A3', 'a3'], b1: ['B1', 'b1'], bl1: ['BL1', 'bl1'],
        incolor: ['INC', 'clear'], clear: ['INC', 'clear'], transparente: ['INC', 'clear'],
        translucida: ['TR', 'translucent'], translucent: ['TR', 'translucent'], translucid: ['TR', 'translucent'],
        rosa: ['RS', 'pink'], bege: ['BG', 'beige'], ocre: ['OC', 'ochre'], salmao: ['SL', 'salmon'],
      };
      const [code, tone] = codes[base] || [label.toUpperCase(), 'unknown'];
      if (!shades.has(base)) shades.set(base, { label, code, tone });
    }
  }
  return [...shades.values()];
}

export interface CatalogSpec { label: string; value: string }

export function basicResinSpecs(rows: CatalogSpec[]): CatalogSpec[] {
  const groups = [
    /^(resistencia (?:flexural|a flexao)|flexural strength|resistencia a la flexion)/,
    /^(modulo flexural|flexural modulus)/,
    /^(viscosidade|viscosity|viscosidad)/,
    /^(carga por peso|filler by weight|carga inorganica \(peso\))/,
    /^(carga por volum|filler by volume|carga inorganica \(volume\))/,
    /^(sorcao (?:de )?agua|water sorption|sorcion (?:de )?agua)/,
    /^(radiopacidade|radiopacity|radiopacidad)/,
  ];
  return groups.flatMap(pattern => {
    const row = rows.find(item => pattern.test(normalized(item.label)) && item.value.trim());
    return row ? [row] : [];
  });
}