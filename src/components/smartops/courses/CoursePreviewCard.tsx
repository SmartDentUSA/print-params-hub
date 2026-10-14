import { CalendarDays, Clock, GraduationCap, MapPin, UserCircle } from "lucide-react";
import "@/styles/course-professional-card.css";
import { CoursePrice } from "@/components/knowledge/CourseDetailBlocks";
import { COURSE_CATEGORIES, COURSE_MODALITIES, type ProfessionalCourseDraft } from "@/types/professionalCourses";

const fmtDate = (d?: string | null) => {
  if (!d || d.length < 10) return null;
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

/**
 * Prévia ao vivo do card público do curso (mesmo visual da página pública de cursos).
 * Só lê o rascunho em edição; nada é gravado.
 */
export default function CoursePreviewCard({
  course,
  producer,
}: {
  course: ProfessionalCourseDraft;
  producer?: { nome?: string | null; prof_photo_url?: string | null; prof_mini_cv?: string | null } | null;
}) {
  const c = course;
  const mod = COURSE_MODALITIES.find((m) => m.value === c.modality)?.label ?? c.modality;
  const cat = COURSE_CATEGORIES.find((m: any) => m.value === c.category)?.label ?? c.category;
  const local = [c.city, c.state].filter(Boolean).join(" - ") || c.online_platform || null;
  const date = fmtDate(c.start_date);
  return (
    <div className="space-y-1.5" aria-label="Prévia do card público">
      <p className="text-xs font-medium text-muted-foreground">Prévia ao vivo · como o card aparece na página pública</p>
      <section className="pc-card">
        <header className="pc-head">
          <div className="pc-head-top">
            <div className="pc-avatar">
              {producer?.prof_photo_url ? <img src={producer.prof_photo_url} alt={producer.nome ?? "Profissional"} /> : <UserCircle className="text-muted-foreground/60" />}
            </div>
            <div className="pc-head-main">
              <span className="pc-role">Profissional</span>
              <h3 className="pc-name">{producer?.nome || "Nome do profissional"}</h3>
            </div>
          </div>
        </header>
        <div className="pc-body">
          <article className="pc-course">
            <div className="pc-cover">
              {c.cover_image_url ? <img src={c.cover_image_url} alt={c.title || "Capa"} /> : <div className="pc-cover-empty"><GraduationCap /></div>}
            </div>
            <div className="pc-course-body">
              <div className="pc-ic"><GraduationCap /></div>
              <div className="pc-chips">
                {mod && <span className="pc-chip pc-chip--primary">{mod}</span>}
                {cat && <span className="pc-chip">{cat}</span>}
              </div>
              <div>
                <h4 className="pc-title">{c.title || "Título do curso"}</h4>
                {c.subtitle && <p className="pc-sub line-clamp-2">{c.subtitle}</p>}
              </div>
              {c.description && <p className="pc-desc line-clamp-2">{c.description}</p>}
              <div className="pc-meta">
                {date && <span className="pc-chip"><CalendarDays />{date}{c.start_time ? ` às ${c.start_time}` : ""}</span>}
                {c.duration_days ? <span className="pc-chip pc-chip--primary"><CalendarDays /> {c.duration_days} {c.duration_days === 1 ? "Dia" : "Dias"}</span> : null}
                {c.workload_hours ? <span className="pc-chip"><Clock /> {c.workload_hours}h</span> : null}
                {local ? <span className="pc-chip"><MapPin /> {local}</span> : null}
              </div>
              <div className="pc-offer">
                <CoursePrice price={c.price_brl ?? null} promo={c.promo_price_brl ?? null} installments={c.installments ?? null} compact />
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
