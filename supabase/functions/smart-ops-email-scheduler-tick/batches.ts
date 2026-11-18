// Lotes diários dos e-mails de campanha (horário de São Paulo).
// Cada lote libera mais e-mails a partir do seu horário; o que não sair
// num lote continua no seguinte. Total do dia = soma dos lotes.
export const EMAIL_BATCHES: { startMin: number; size: number; label: string }[] = [
  { startMin: 7 * 60 + 30, size: 100, label: "07:30" },
  { startMin: 12 * 60, size: 100, label: "12:00" },
  { startMin: 15 * 60, size: 100, label: "15:00" },
  { startMin: 17 * 60 + 30, size: 99, label: "17:30" },
];

export const DAILY_CAP = EMAIL_BATCHES.reduce((a, b) => a + b.size, 0);

/** Quantos e-mails o dia já pode ter enviado até este minuto (acumulado dos lotes iniciados). */
export function allowedSoFar(nowMin: number): number {
  let total = 0;
  for (const b of EMAIL_BATCHES) if (nowMin >= b.startMin) total += b.size;
  return total;
}

/** Quantos e-mails ainda podem sair agora, dado o que já saiu hoje. */
export function remainingNow(nowMin: number, sentToday: number): number {
  return Math.max(0, allowedSoFar(nowMin) - Math.max(0, sentToday));
}

/** Intercala filas de várias campanhas (1 de cada por rodada) até o limite. */
export function roundRobin<T>(queues: T[][], limit: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < limit; i++) {
    let any = false;
    for (const q of queues) {
      if (i < q.length) { any = true; out.push(q[i]); if (out.length >= limit) break; }
    }
    if (!any) break;
  }
  return out;
}
