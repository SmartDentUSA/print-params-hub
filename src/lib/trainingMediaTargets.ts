/**
 * Metas mínimas de mídias por pasta do Drive de cada turma.
 * Usadas para mostrar "enviadas / meta" e a bolinha verde quando a pasta está completa.
 */
export const MEDIA_TARGETS: Record<string, number> = {
  fotos_turma: 1,
  fotos_participantes_certificados: 1,
  fotos_atividades: 3,
  fotos_equipamentos: 3,
  fotos_bastidores: 3,
  videos_vertical: 3,
  videos_horizontal: 1,
  videos_atividades: 2,
  videos_bastidores: 1,
  videos_depoimentos: 1,
};

export const PHOTO_TARGET_TOTAL = [
  "fotos_turma",
  "fotos_participantes_certificados",
  "fotos_atividades",
  "fotos_equipamentos",
  "fotos_bastidores",
].reduce((s, k) => s + (MEDIA_TARGETS[k] || 0), 0);

export const VIDEO_TARGET_TOTAL = [
  "videos_vertical",
  "videos_horizontal",
  "videos_atividades",
  "videos_bastidores",
].reduce((s, k) => s + (MEDIA_TARGETS[k] || 0), 0);

/** Meta total de uma turma (fotos + vídeos, sem contar depoimentos por participante). */
export const TURMA_MEDIA_TARGET = PHOTO_TARGET_TOTAL + VIDEO_TARGET_TOTAL;

export function targetFor(destKey: string): number {
  return MEDIA_TARGETS[destKey] ?? 0;
}

export function isGoalReached(count: number, target: number): boolean {
  return target > 0 && count >= target;
}
