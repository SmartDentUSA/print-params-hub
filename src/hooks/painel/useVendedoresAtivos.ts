import { useMemo } from "react";
import { useActiveTeamMembers } from "@/hooks/useActiveTeamMembers";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * O painel só mostra vendedores marcados como ativos em Team Members.
 * Enquanto a lista de ativos não carrega, não filtramos (evita tela vazia na TV).
 */
export function useFiltroVendedoresAtivos() {
  const { data } = useActiveTeamMembers();

  return useMemo(() => {
    const ativos = new Set((data ?? []).map((m) => norm(m.nome_completo ?? "")));
    return function filtrar<T extends { vendedor: string }>(rows: T[]): T[] {
      if (ativos.size === 0) return rows;
      return rows.filter((r) => r.vendedor && ativos.has(norm(r.vendedor)));
    };
  }, [data]);
}