import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Star } from "lucide-react";

interface Inscrito {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  data: string | null;
}
export interface OwnCourseStats {
  course_id: string;
  views: number;
  inscritos: number;
  avaliacoes: number;
  avaliacao_media: number | null;
  inscritos_list: Inscrito[];
}

const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const waLink = (phone: string | null, msg: string) => {
  const d = digits(phone);
  if (d.length < 10) return null;
  const full = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
};

/** Métricas e inscritos de um curso enviado pelo próprio profissional. */
export default function PortalOwnCourseStats({
  courseId, courseTitle, call, profName,
}: {
  courseId: string;
  courseTitle: string;
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
  profName: string;
}) {
  const [stats, setStats] = useState<OwnCourseStats | null>(null);

  useEffect(() => {
    let alive = true;
    call("own_course_stats")
      .then((d) => {
        if (!alive) return;
        const found = (d.own_courses ?? []).find((x: OwnCourseStats) => x.course_id === courseId);
        setStats(found ?? null);
      })
      .catch(() => {});
  }, [call, courseId]);

  if (!stats) return null;

  const firstName = profName.trim().split(/\s+/)[0] || "profissional";
  const msg = (nome: string | null) =>
    `Olá ${(nome ?? "").split(" ")[0]}, tudo bem?\nAqui é o ${firstName}.\nVi sua inscrição no curso ${courseTitle}. Posso te ajudar com mais informações?`;

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
        <span><span className="text-muted-foreground">Visualizações:</span> <b>{stats.views}</b></span>
        <span><span className="text-muted-foreground">Inscrições via formulário:</span> <b>{stats.inscritos}</b></span>
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground">Avaliações:</span> <b>{stats.avaliacoes}</b>
          {stats.avaliacao_media != null && (
            <Badge variant="secondary" className="text-[10px]"><Star className="w-3 h-3 mr-0.5 text-amber-500" />{stats.avaliacao_media}</Badge>
          )}
        </span>
      </div>
      {stats.inscritos_list.length > 0 && (
        <ul className="divide-y rounded-md border">
          {stats.inscritos_list.map((e) => {
            const link = waLink(e.telefone, msg(e.nome));
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                <span className="font-medium">{e.nome ?? "—"}</span>
                <span className="text-muted-foreground">{[e.email, e.area_atuacao, e.especialidade, e.telefone].filter(Boolean).join(" · ")}</span>
                {link && (
                  <Button asChild size="sm" variant="outline" className="ml-auto h-7">
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      onClick={() => void call("log_wa_click", { target_name: e.nome ?? "inscrito", course_id: courseId }).catch(() => {})}>
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> Chamar no WhatsApp
                    </a>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
