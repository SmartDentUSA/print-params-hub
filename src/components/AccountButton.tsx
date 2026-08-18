import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleUserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Widget de conta do cliente: "Olá, Bem-vindo(a) — Entre ou Cadastre-se" */
export function AccountButton() {
  const [nome, setNome] = useState<string | null>(null);
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  const loginHref = nome
    ? "/entrar"
    : `/entrar?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const meta = (data.user?.user_metadata ?? {}) as { nome?: string };
      setNome(data.user ? (meta.nome?.split(" ")[0] ?? "cliente") : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const meta = (session?.user?.user_metadata ?? {}) as { nome?: string };
      setNome(session?.user ? (meta.nome?.split(" ")[0] ?? "cliente") : null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <Link
      to={loginHref}
      className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-muted"
      aria-label="Entrar ou cadastrar-se"
    >
      <CircleUserRound className="w-7 h-7 md:w-8 md:h-8 text-foreground/70 shrink-0" strokeWidth={1.5} />
      <span className="hidden sm:flex flex-col leading-tight text-left">
        <span className="text-[11px] text-muted-foreground">
          {nome ? `Olá, ${nome}` : "Olá, Bem-vindo(a)"}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {nome ? "Minha conta" : <>Entre <span className="font-normal text-muted-foreground">ou</span> Cadastre-se</>}
        </span>
      </span>
    </Link>
  );
}
