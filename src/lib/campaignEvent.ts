/** Event association is campaign metadata, never part of audience filters. */
export function campaignEventId(value?: string | null): string | null {
  return value?.trim() || null;
}