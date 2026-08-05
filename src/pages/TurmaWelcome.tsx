import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import bgImage from "@/assets/turma-welcome-bg.png";

interface WelcomeParticipant {
  name: string;
  state?: string | null;
  city?: string | null;
  full_name: string;
  companions: string[];
}

interface WelcomeData {
  turma: {
    number: number | null;
    label: string | null;
    modality: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
  };
  course: { title: string; instructor_name: string | null };
  participants: WelcomeParticipant[];
  total_people: number;
}

function formatPeriodo(start?: string | null, end?: string | null) {
  if (!start) return null;
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} a ${fmt(end)}`;
}

export default function TurmaWelcome() {
  const params = useParams();
  const slug = params.turmaSlug || params.brandSlug || "";
  const numero = String(slug).replace(/\D/g, "");
  const [data, setData] = useState<WelcomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Bem vindos — Turma ${numero} | Smart Dent`;
  }, [numero]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: res, error: err } = await supabase.functions.invoke(
          `turma-welcome?n=${numero}`,
          { method: "GET" },
        );
        if (err) throw err;
        if (!cancelled) {
          if ((res as any)?.error) setError(String((res as any).error));
          else setData(res as WelcomeData);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erro ao carregar turma");
      }
    };
    if (numero) load();
    const id = setInterval(() => numero && load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [numero]);

  const nomes = useMemo(() => {
    if (!data) return [] as string[];
    const out: string[] = [];
    for (const p of data.participants) {
      out.push(p.name);
      for (const c of p.companions) out.push(c);
    }
    return out;
  }, [data]);

  const nameSize =
    nomes.length > 24 ? "1.4vw" : nomes.length > 16 ? "1.8vw" : nomes.length > 9 ? "2.2vw" : "2.8vw";

  return (
    <div className="tw-root">
      <style>{`
        .tw-root {
          position: fixed; inset: 0; overflow: hidden;
          background: #04101c url('${bgImage}') center / cover no-repeat;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex;
          padding: 26vh 6vw 14vh;
        }
        .tw-names { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
        .tw-grid { display: grid; gap: 1.2vh 4vw; width: 100%; justify-items: center; }
        .tw-name { font-weight: 600; letter-spacing: .01em; text-align: center; }
        .tw-name.tw-companion { color: #b9cad6; font-weight: 400; }
        .tw-state { display: inline-block; margin-top: .4vh; font-size: .95vw; font-weight: 700; letter-spacing: .14em; color: #f26522; text-transform: uppercase; }
      `}</style>

      <main className="tw-names">
        {error ? (
          <p style={{ color: "#8fa6b6", fontSize: "1.4vw" }}>
            {error === "turma_not_found" ? `Turma ${numero} não encontrada.` : error}
          </p>
        ) : !data ? (
          <p style={{ color: "#8fa6b6", fontSize: "1.4vw" }}>Carregando…</p>
        ) : nomes.length === 0 ? (
          <p style={{ color: "#8fa6b6", fontSize: "1.4vw" }}>Nenhum participante confirmado.</p>
        ) : (
          <div
            className="tw-grid"
            style={{
              gridTemplateColumns: `repeat(${nomes.length > 12 ? 3 : nomes.length > 5 ? 2 : 1}, minmax(0, 1fr))`,
            }}
          >
            {data.participants.map((p, i) => (
              <div key={`${p.full_name}-${i}`} style={{ textAlign: "center" }}>
                <div className="tw-name" style={{ fontSize: nameSize }}>{p.name}</div>
                {p.state ? <div className="tw-state">{p.state}</div> : null}
                {p.companions.map((c, j) => (
                  <div
                    key={`${c}-${j}`}
                    className="tw-name tw-companion"
                    style={{ fontSize: `calc(${nameSize} * .72)` }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
