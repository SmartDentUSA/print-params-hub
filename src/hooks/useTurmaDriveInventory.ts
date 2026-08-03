import { useQuery } from "@tanstack/react-query";
import { fetchDriveInventory, type DriveInventory } from "@/lib/trainingDriveUpload";

/** Inventário real das subpastas do Drive da turma (conta arquivos enviados fora do sistema). */
export function useTurmaDriveInventory(turmaId: string, enabled = true) {
  return useQuery<DriveInventory>({
    queryKey: ["turma-drive-inventory", turmaId],
    enabled: enabled && !!turmaId,
    staleTime: 60_000,
    queryFn: () => fetchDriveInventory(turmaId),
  });
}

/** UPPER-KEBAB igual ao naming do servidor (para casar depoimentos por participante). */
export function upperKebabName(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
