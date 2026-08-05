import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import bgAsset from "@/assets/turma-welcome-bg.png.asset.json";

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

  const periodo = formatPeriodo(data?.turma.start_date, data?.turma.end_date);

  return (
    <div className="tw-root">
      <style>{`
        .tw-root {
          position: fixed; inset: 0; overflow: hidden;
          background:
            radial-gradient(1200px 800px at 62% 48%, #123a52 0%, rgba(18,58,82,0) 62%),
            linear-gradient(135deg, #04101c 0%, #061a2b 45%, #030b14 100%);
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex; flex-direction: column;
          padding: 4vh 5vw;
        }
        .tw-root::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px);
          opacity: .5;
        }
        .tw-accent { display: flex; align-items: center; gap: .5rem; margin-bottom: 1.2vh; }
        .tw-accent i { width: 9px; height: 9px; border-radius: 50%; background: #f26522; display: block; }
        .tw-accent span { height: 2px; width: 12vw; background: #f26522; display: block; }
        .tw-title { color: #fff; font-size: 5.2vw; font-weight: 800; letter-spacing: -.02em; line-height: .95; margin: 0; }
        .tw-sub { font-size: 1.9vw; letter-spacing: .22em; color: #9fb3c2; text-transform: uppercase; margin: .6vh 0 0; font-weight: 300; }
        .tw-meta { margin-top: 1vh; font-size: 1.05vw; color: #6f8698; letter-spacing: .12em; text-transform: uppercase; }
        .tw-names { flex: 1; display: flex; align-items: center; justify-content: center; }
        .tw-grid { display: grid; gap: 1.2vh 4vw; width: 100%; justify-items: center; }
        .tw-name { font-weight: 600; letter-spacing: .01em; text-align: center; }
        .tw-name.tw-companion { color: #b9cad6; font-weight: 400; }
        .tw-state { display: inline-block; margin-top: .4vh; font-size: .95vw; font-weight: 700; letter-spacing: .14em; color: #f26522; text-transform: uppercase; }
        .tw-footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 2vw; position: relative; z-index: 1; }
        .tw-addr { display: flex; gap: 3vw; font-size: .72vw; color: #cfdae2; line-height: 1.5; }
        .tw-addr b { display: block; font-size: .85vw; color: #fff; margin-bottom: .3vh; }
        .tw-flag { font-size: .8vw; font-weight: 700; letter-spacing: .1em; color: #f26522; margin-right: .8vw; padding-top: .2vh; }
        .tw-brand { font-size: 2vw; font-weight: 700; letter-spacing: .12em; color: #fff; opacity: .95; }
        .tw-brand span { color: #f26522; }
      `}</style>

      <header style={{ position: "relative", zIndex: 1 }}>
        <div className="tw-accent"><i /><span /></div>
        <h1 className="tw-title">BEM VINDOS!</h1>
        <p className="tw-sub">{data?.course.title || "Treinamento Smart Dent"}</p>
        <div className="tw-meta">
          {[
            data?.turma.number ? `Turma #${data.turma.number}` : `Turma ${numero}`,
            periodo,
            data?.turma.location,
            data?.course.instructor_name ? `Instrutor: ${data.course.instructor_name}` : null,
          ]
            .filter(Boolean)
            .join("  •  ")}
        </div>
      </header>

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

      <footer className="tw-footer">
        <div className="tw-addr">
          <div style={{ display: "flex" }}>
            <span className="tw-flag">BR</span>
            <div>
              <b>Smart Dent — BR</b>
              São Carlos - SP<br />
              R. Dr. Procópio de Tolêdo Malta, 62 - Morada dos Deuses<br />
              São Carlos - SP, 13562-291
            </div>
          </div>
          <div style={{ display: "flex" }}>
            <span className="tw-flag">US</span>
            <div>
              <b>Smart Dent — USA</b>
              University of North Carolina<br />
              9201 University City Blvd, Charlotte, NC<br />
              28223, USA
            </div>
          </div>
        </div>
        <div className="tw-brand"><span>/</span>SMART DENT</div>
      </footer>
    </div>
  );
}
