export function formatTurmaNumber(
  n: number | null | undefined,
  modality?: string | null,
): string | null {
  if (!n) return null;
  if (modality === "presencial") return `#${n}`;
  return `#${String(n).padStart(3, "0")}`;
}