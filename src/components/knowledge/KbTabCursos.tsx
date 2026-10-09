import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  MapPin,
  CalendarDays,
  Clock,
  Filter,
  X,
  UserCircle,
  ExternalLink,
  Instagram,
  Tag,
  Users,
  Globe,
  Award,
  Video,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import KbSearchBar from './KbSearchBar';
import CourseRating, { RatingSummaryBadge } from './CourseRating';
import '@/styles/course-professional-card.css';
import { CourseCountdown, CourseSeats, CoursePrice, MiniCv, SyllabusPremium } from './CourseDetailBlocks';

/** Converte URL de vídeo (YouTube, PandaVideo, mp4) em embed. */
function videoEmbed(url: string): { type: 'iframe' | 'video'; src: string } | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { type: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'video', src: url };
  if (/embed|player|pandavideo/i.test(url)) return { type: 'iframe', src: url };
  return null;
}

interface SyllabusModule {
  title?: string | null;
  items?: string[] | null;
}

interface ProfCourse {
  id: string;
  producer_lead_id: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  modality: string | null;
  category: string | null;
  cover_image_url: string | null;
  workload_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  venue: string | null;
  address: string | null;
  online_platform: string | null;
  meeting_link: string | null;
  course_platform: string | null;
  video_url: string | null;
  duration_days: number | null;
  end_time: string | null;
  max_students: number | null;
  enrolled_count: number | null;
  language: string | null;
  tags: string[] | null;
  registration_url: string | null;
  whatsapp_ddi: string | null;
  whatsapp_number: string | null;
  instagram: string | null;
  featured: boolean | null;
  published_at: string | null;
  target_audience: string | null;
  prerequisites: string | null;
  syllabus: SyllabusModule[] | null;
  price_brl: number | null;
  promo_price_brl: number | null;
  installments: number | null;
  certificate: boolean | null;
  materials_included: string | null;
}

interface Kol {
  id: string;
  nome: string | null;
  prof_photo_url: string | null;
  especialidade: string | null;
  instagram: string | null;
  prof_mini_cv: string | null;
  cliente_desde: string | null;
}

const fmtDate = (d?: string | null) => {
  if (!d || d.length < 10) return null;
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
};

const fmtMoney = (v?: number | null) =>
  typeof v === 'number' && !Number.isNaN(v)
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;

const igHandle = (v?: string | null) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
  return cleaned;
};

const LABELS: Record<string, string> = {
  live_produtos: 'Live de produtos',
  online: 'Online',
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  imersao: 'Imersão',
  workshop: 'Workshop',
  mentoria: 'Mentoria',
  curso: 'Curso',
  palestra: 'Palestra',
  treinamento: 'Treinamento',
};

const label = (v?: string | null) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (LABELS[key]) return LABELS[key];
  return raw.replace(/_/g, ' ').replace(/^\w/, (m) => m.toUpperCase());
};

const norm = (s?: string | null) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export default function KbTabCursos() {
  const [selectedKol, setSelectedKol] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedEsp, setSelectedEsp] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<{ course: ProfCourse; kol?: Kol } | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['kb_professional_courses'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('professional_courses')
        .select('*')
        .eq('public_visible', true)
        .eq('status', 'publicado')
        .order('featured', { ascending: false })
        .order('start_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const own = (data ?? []) as ProfCourse[];

      // Treinamentos Smart Dent aprovados no card do profissional ("Cursos recomendados")
      const { data: recs } = await (supabase as any)
        .from('smartops_courses')
        .select('id, title, slug, description, modality, category, cover_image_url, duration_days, location, meeting_link, max_capacity, signup_form_url, public_enrollment_enabled, recommend_professional_ids')
        .eq('recommend_on_instructor_card', true)
        .eq('active', true)
        .eq('public_visible', true);
      const approved = ((recs ?? []) as any[]).filter((c) => (c.recommend_professional_ids ?? []).length > 0);
      if (approved.length === 0) return own;

      const { data: turmas } = await (supabase as any)
        .from('v_turmas_com_vagas')
        .select('course_id, start_date, end_date, start_time, end_time, enrolled_count')
        .in('course_id', approved.map((c) => c.id))
        .eq('active', true)
        .order('start_date', { ascending: true });
      const today = new Date().toISOString().slice(0, 10);
      const nextTurma: Record<string, any> = {};
      for (const t of (turmas ?? []) as any[]) {
        if (nextTurma[t.course_id]) continue;
        if (!t.start_date || (t.end_date ?? t.start_date) >= today) nextTurma[t.course_id] = t;
      }

      const smartDent: ProfCourse[] = [];
      for (const c of approved) {
        const t = nextTurma[c.id];
        const registration = c.public_enrollment_enabled && c.slug ? `/inscricao/${c.slug}` : c.signup_form_url ?? null;
        for (const profId of c.recommend_professional_ids as string[]) {
          if (own.some((o: any) => o.source_smartops_course_id === c.id && o.producer_lead_id === profId)) continue;
          smartDent.push({
            id: `sd-${c.id}-${profId}`,
            producer_lead_id: profId,
            title: c.title,
            subtitle: null,
            description: c.description ?? null,
            modality: c.modality ?? null,
            category: c.category ?? null,
            cover_image_url: c.cover_image_url ?? null,
            workload_hours: null,
            start_date: t?.start_date ?? null,
            end_date: t?.end_date ?? null,
            start_time: t?.start_time ?? null,
            city: null,
            state: null,
            country: null,
            venue: c.location ?? null,
            address: null,
            online_platform: null,
            meeting_link: null,
            course_platform: 'Smart Dent',
            video_url: null,
            duration_days: c.duration_days ?? null,
            end_time: t?.end_time ?? null,
            max_students: c.max_capacity ?? null,
            enrolled_count: t?.enrolled_count ?? null,
            language: null,
            tags: ['Smart Dent'],
            registration_url: registration,
            whatsapp_ddi: null,
            whatsapp_number: null,
            instagram: null,
            featured: true,
            published_at: null,
            target_audience: null,
            prerequisites: null,
            syllabus: null,
            price_brl: null,
            promo_price_brl: null,
            installments: null,
            certificate: null,
            materials_included: null,
          });
        }
      }
      return [...smartDent, ...own];
    },
  });

  const producerIds = useMemo(
    () => Array.from(new Set(courses.map((c) => c.producer_lead_id).filter(Boolean))) as string[],
    [courses],
  );

  const { data: kols = {} } = useQuery({
    queryKey: ['kb_professional_courses_kols', producerIds.join(',')],
    enabled: producerIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: rows, error: err1 }, { data: mirrors }] = await Promise.all([
        (supabase as any).rpc('fn_public_course_professionals', { _ids: producerIds }),
        (supabase as any)
          .from('piperun_persons_mirror')
          .select('lia_attendance_id, cliente_desde')
          .in('lia_attendance_id', producerIds)
          .order('created_at', { ascending: false }),
      ]);
      if (err1) throw err1;

      const sinceMap: Record<string, string> = {};
      for (const m of (mirrors ?? []) as { lia_attendance_id: string; cliente_desde: string | null }[]) {
        if (m.cliente_desde && !sinceMap[m.lia_attendance_id]) {
          sinceMap[m.lia_attendance_id] = m.cliente_desde;
        }
      }

      const map: Record<string, Kol> = {};
      for (const row of (rows ?? []) as Kol[]) {
        map[row.id] = { ...row, cliente_desde: sinceMap[row.id] ?? null };
      }
      return map;
    },
  });

  const kolOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of courses) {
      const k = c.producer_lead_id ? kols[c.producer_lead_id] : undefined;
      if (k?.nome) set.set(k.id, k.nome);
    }
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [courses, kols]);

  const tipoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) {
      if (c.category) set.add(c.category);
      if (c.modality) set.add(c.modality);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [courses]);

  const espOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) {
      const k = c.producer_lead_id ? kols[c.producer_lead_id] : undefined;
      if (k?.especialidade) set.add(k.especialidade);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [courses, kols]);

  const visible = useMemo(() => {
    const q = norm(search);
    return courses.filter((c) => {
      if (selectedKol && c.producer_lead_id !== selectedKol) return false;
      if (selectedTipo && norm(c.category) !== norm(selectedTipo) && norm(c.modality) !== norm(selectedTipo)) return false;
      const k = c.producer_lead_id ? kols[c.producer_lead_id] : undefined;
      if (selectedEsp && norm(k?.especialidade) !== norm(selectedEsp)) return false;
      if (q) {
        const hay = norm(
          [c.title, c.subtitle, c.description, c.category, c.modality, c.city, c.state, k?.nome, k?.especialidade]
            .filter(Boolean)
            .join(' '),
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, kols, selectedKol, selectedTipo, selectedEsp, search]);




  const hasFilters = !!(selectedKol || selectedTipo || selectedEsp || search);

  const ctaUrl = (c: ProfCourse) => {
    if (c.whatsapp_number) {
      const digits = `${c.whatsapp_ddi ?? '55'}${c.whatsapp_number}`.replace(/\D/g, '');
      const owner = (c.producer_lead_id ? kols[c.producer_lead_id]?.nome : null) || 'Smart Dent';
      const firstName = String(owner).trim().split(/\s+/)[0];
      const msg = `Olá ${firstName}, vi este curso ${c.title}, na página da Smart Dent, gostaria de mais informações`;
      return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
    }
    if (c.registration_url) return c.registration_url;
    if (c.instagram) return `https://instagram.com/${igHandle(c.instagram)}`;
    return null;
  };


  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando cursos…</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum curso publicado no momento.</p>
      </div>
    );
  }

  const detailCourse = detail?.course;
  const detailSyllabus = Array.isArray(detailCourse?.syllabus) ? detailCourse!.syllabus! : [];
  const detailPrice = fmtMoney(detailCourse?.price_brl);
  const detailPromo = fmtMoney(detailCourse?.promo_price_brl);

  return (
    <div className="pc-page">
      <KbSearchBar
        placeholder="Buscar curso, parceiro, cidade…"
        value={search}
        onDebouncedChange={setSearch}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {kolOptions.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedKol}
              onChange={(e) => setSelectedKol(e.target.value)}
              aria-label="Filtrar por parceiro"
              className="appearance-none h-9 pl-8 pr-8 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[200px]"
            >
              <option value="">Todos os parceiros</option>
              {kolOptions.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▼</span>
          </div>
        )}

        {tipoOptions.length > 0 && (
          <div className="relative">
            <select
              value={selectedTipo}
              onChange={(e) => setSelectedTipo(e.target.value)}
              aria-label="Filtrar por tipo"
              className="appearance-none h-9 pl-3.5 pr-8 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[160px]"
            >
              <option value="">Todos os tipos</option>
              {tipoOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▼</span>
          </div>
        )}

        {espOptions.length > 0 && (
          <div className="relative">
            <select
              value={selectedEsp}
              onChange={(e) => setSelectedEsp(e.target.value)}
              aria-label="Filtrar por especialidade"
              className="appearance-none h-9 pl-3.5 pr-8 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]"
            >
              <option value="">Todas as especialidades</option>
              {espOptions.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▼</span>
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setSelectedKol(''); setSelectedTipo(''); setSelectedEsp(''); setSearch(''); }}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-full border bg-background text-xs font-medium hover:bg-accent transition-colors"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} {visible.length === 1 ? 'curso' : 'cursos'}
        </span>
      </div>

      {visible.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum curso encontrado com esses filtros.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {Array.from(
          visible
            .reduce((acc, c) => {
              const key = c.producer_lead_id || '__smartdent';
              if (!acc.has(key)) acc.set(key, []);
              acc.get(key)!.push(c);
              return acc;
            }, new Map<string, ProfCourse[]>())
            .entries(),
        )
          .sort((a, b) => {
            const nameA = kols[a[0]]?.nome || 'Smart Dent';
            const nameB = kols[b[0]]?.nome || 'Smart Dent';
            return nameA.localeCompare(nameB, 'pt-BR');
          })
          .map(([producerId, list]) => {
            const kol = producerId !== '__smartdent' ? kols[producerId] : undefined;
            const handle = igHandle(kol?.instagram);
            return (
              <section key={producerId} className="pc-card">
                <header className="pc-head">
                  <div className="pc-avatar">
                    {kol?.prof_photo_url ? (
                      <img
                        src={kol.prof_photo_url}
                        alt={kol.nome ?? 'Profissional'}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <UserCircle className="text-muted-foreground/60" />
                    )}
                  </div>

                  <div className="pc-head-main">
                    {kol?.especialidade && <p className="pc-role">{kol.especialidade}</p>}
                    <h3 className="pc-name">{kol?.nome ?? 'Smart Dent'}</h3>
                    {kol?.prof_mini_cv && (
                      <p className="pc-cv line-clamp-3">{kol.prof_mini_cv}</p>
                    )}
                    <div className="pc-head-pills">
                      {handle && (
                        <a
                          href={`https://instagram.com/${handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pc-pill pc-pill--accent"
                        >
                          <Instagram /> @{handle}
                        </a>
                      )}
                      {kol?.cliente_desde && (
                        <span className="pc-pill">
                          <Award /> Smart Dent desde {fmtDate(kol.cliente_desde)}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="pc-pill pc-count">
                    <GraduationCap /> {list.length} {list.length === 1 ? 'curso' : 'cursos'}
                  </span>
                </header>

                <div className="pc-body">
                  {list.map((c) => {
                    const local = [c.city, c.state].filter(Boolean).join(' - ') || c.online_platform || null;
                    const date = fmtDate(c.start_date);
                    const open = () => setDetail({ course: c, kol });
                    return (
                      <article key={c.id} className="pc-course">
                        <div
                          className="pc-cover"
                          role="button"
                          tabIndex={0}
                          aria-label={`Ver informações do curso ${c.title}`}
                          onClick={open}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              open();
                            }
                          }}
                        >
                          {c.cover_image_url ? (
                            <img
                              src={c.cover_image_url}
                              alt={c.title}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="pc-cover-empty">
                              <GraduationCap />
                            </div>
                          )}
                          {c.start_date && (
                            <div className="pc-cd-overlay">
                              <CourseCountdown date={c.start_date} time={c.start_time} compact />
                            </div>
                          )}
                        </div>

                        <div className="pc-course-body">
                          <div className="pc-ic"><GraduationCap /></div>
                          <div className="pc-chips">
                            {c.modality && (
                              <span className="pc-chip pc-chip--primary">{label(c.modality)}</span>
                            )}
                            {c.category && <span className="pc-chip">{label(c.category)}</span>}
                            {c.featured && <span className="pc-chip pc-chip--featured">Destaque</span>}
                          </div>

                          <div>
                            <h4 className="pc-title" onClick={open}>
                              {c.title}
                            </h4>
                            {c.subtitle && <p className="pc-sub line-clamp-2">{c.subtitle}</p>}
                          </div>

                          {c.description && <p className="pc-desc line-clamp-2">{c.description}</p>}

                          <div className="pc-meta">
                            {date && (
                              <span className="pc-chip">
                                <CalendarDays />
                                {date}
                                {c.start_time ? ` às ${c.start_time}` : ''}
                              </span>
                            )}
                            {c.duration_days ? (
                              <span className="pc-chip pc-chip--primary">
                                <CalendarDays /> {c.duration_days} {c.duration_days === 1 ? 'Dia' : 'Dias'}
                              </span>
                            ) : null}
                            {c.workload_hours ? (
                              <span className="pc-chip">
                                <Clock /> {c.workload_hours}h
                              </span>
                            ) : null}
                            {local ? (
                              <span className="pc-chip">
                                <MapPin /> {local}
                              </span>
                            ) : null}
                          </div>

                          <div className="pc-offer">
                            <CoursePrice
                              price={c.price_brl}
                              promo={c.promo_price_brl}
                              installments={c.installments}
                              compact
                            />
                          </div>

                          <div className="pc-actions">
                            <button type="button" className="pc-cta" onClick={open}>
                              Informações do curso <ArrowRight />
                            </button>
                            {!c.id.startsWith('sd-') && <RatingSummaryBadge courseId={c.id} />}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>



      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          {detailCourse && (
            <>
              {/* Professor — acima do título */}
              {detail?.kol && (
                <div className="p-5 sm:p-6 pb-0">
                  <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-primary/10">
                      {detail.kol.prof_photo_url ? (
                        <img
                          src={detail.kol.prof_photo_url}
                          alt={detail.kol.nome ?? 'Profissional'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <UserCircle className="w-full h-full text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {detail.kol.nome}
                      </div>
                      {detail.kol.especialidade && (
                        <div className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-primary truncate">
                          {detail.kol.especialidade}
                        </div>
                      )}
                      {igHandle(detail.kol.instagram) && (
                        <a
                          href={`https://instagram.com/${igHandle(detail.kol.instagram)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <Instagram className="w-3 h-3" /> @{igHandle(detail.kol.instagram)}
                        </a>
                      )}
                      {detail.kol.cliente_desde && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Cliente Smart Dent desde {fmtDate(detail.kol.cliente_desde)}
                        </p>
                      )}
                    </div>
                  </div>
                  {detail.kol.prof_mini_cv && <MiniCv cv={detail.kol.prof_mini_cv} />}
                </div>
              )}

              {/* Hero */}
              <div className="relative">
                <div className="aspect-[16/7] w-full overflow-hidden bg-muted">
                  {(() => {
                    const heroEmbed = detailCourse.video_url ? videoEmbed(detailCourse.video_url) : null;
                    if (heroEmbed) {
                      return heroEmbed.type === 'iframe' ? (
                        <iframe
                          src={heroEmbed.src}
                          title={`Vídeo do curso ${detailCourse.title}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      ) : (
                        <video src={heroEmbed.src} className="w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" />
                      );
                    }
                    if (detailCourse.cover_image_url) {
                      return (
                        <img
                          src={detailCourse.cover_image_url}
                          alt={detailCourse.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      );
                    }
                    return (
                      <div className="pc-hero-empty w-full h-full flex items-center justify-center">
                        <GraduationCap />
                      </div>
                    );
                  })()}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {detailCourse.modality && <Badge variant="secondary">{label(detailCourse.modality)}</Badge>}
                    {detailCourse.category && <Badge variant="outline">{label(detailCourse.category)}</Badge>}
                    {detailCourse.certificate && <Badge variant="outline">Com certificado</Badge>}
                  </div>
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-xl sm:text-2xl font-bold leading-tight">
                      {detailCourse.title}
                    </DialogTitle>
                    {detailCourse.subtitle && (
                      <DialogDescription className="text-sm sm:text-base">
                        {detailCourse.subtitle}
                      </DialogDescription>
                    )}
                  </DialogHeader>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {(detailCourse.max_students || detailCourse.start_date) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CourseCountdown date={detailCourse.start_date} time={detailCourse.start_time} />
                    <CourseSeats total={detailCourse.max_students} enrolled={detailCourse.enrolled_count} />
                  </div>
                )}
                {/* Fatos rápidos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(detailCourse.category || detailCourse.modality) && (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <Tag className="w-3.5 h-3.5" /> Tipo de curso
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {[label(detailCourse.category), label(detailCourse.modality)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  )}
                  {fmtDate(detailCourse.start_date) && (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <CalendarDays className="w-3.5 h-3.5" /> Data
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {fmtDate(detailCourse.start_date)}
                        {detailCourse.end_date && detailCourse.end_date !== detailCourse.start_date
                          ? ` a ${fmtDate(detailCourse.end_date)}`
                          : ''}
                        {detailCourse.start_time ? ` · ${detailCourse.start_time}` : ''}
                      </div>
                    </div>
                  )}
                  {detailCourse.start_time || detailCourse.end_time ? (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Horário
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {[detailCourse.start_time, detailCourse.end_time].filter(Boolean).join(' às ')}
                      </div>
                    </div>
                  ) : null}
                  {detailCourse.workload_hours || detailCourse.duration_days ? (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" /> Carga horária
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {[
                          detailCourse.workload_hours ? `${detailCourse.workload_hours}h` : null,
                          detailCourse.duration_days
                            ? `${detailCourse.duration_days} ${detailCourse.duration_days === 1 ? 'dia' : 'dias'}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  ) : null}
                  {([detailCourse.venue, detailCourse.city, detailCourse.state].filter(Boolean).join(' - ') ||
                    detailCourse.online_platform ||
                    detailCourse.course_platform) && (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <MapPin className="w-3.5 h-3.5" /> Local
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {[detailCourse.venue, detailCourse.city, detailCourse.state].filter(Boolean).join(' - ') ||
                          detailCourse.online_platform ||
                          detailCourse.course_platform}
                      </div>
                      {detailCourse.address && (
                        <div className="text-xs text-muted-foreground mt-0.5">{detailCourse.address}</div>
                      )}
                    </div>
                  )}
                  {detailCourse.max_students ? (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <Users className="w-3.5 h-3.5" /> Vagas
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {detailCourse.max_students} no total
                        {typeof detailCourse.enrolled_count === 'number'
                          ? ` · ${Math.max(detailCourse.max_students - detailCourse.enrolled_count, 0)} disponíveis`
                          : ''}
                      </div>
                    </div>
                  ) : null}
                  {detailCourse.language && (
                    <div className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        <Globe className="w-3.5 h-3.5" /> Idioma
                      </div>
                      <div className="text-sm font-medium text-foreground">{label(detailCourse.language)}</div>
                    </div>
                  )}
                  <div className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      <Award className="w-3.5 h-3.5" /> Certificado
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {detailCourse.certificate ? 'Incluso' : 'Não incluso'}
                    </div>
                  </div>
                </div>

                {detailCourse.video_url && (() => {
                  const embed = videoEmbed(detailCourse.video_url);
                  return embed ? (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                      {embed.type === 'iframe' ? (
                        <iframe
                          src={embed.src}
                          title={`Vídeo do curso ${detailCourse.title}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                        />
                      ) : (
                        <video src={embed.src} controls className="w-full h-full" preload="metadata" />
                      )}
                    </div>
                  ) : (
                    <a
                      href={detailCourse.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <Video className="w-4 h-4" /> Assistir vídeo de apresentação
                    </a>
                  );
                })()}

                {detailCourse.description && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Descrição
                    </h4>
                    <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                      {detailCourse.description}
                    </p>
                  </section>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {detailCourse.target_audience && (
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        Público-alvo
                      </h4>
                      <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                        {detailCourse.target_audience}
                      </p>
                    </section>
                  )}
                  {detailCourse.prerequisites && (
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        Pré-requisitos
                      </h4>
                      <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                        {detailCourse.prerequisites}
                      </p>
                    </section>
                  )}
                </div>

                {detailSyllabus.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Conteúdo programático
                    </h4>
                    <SyllabusPremium modules={detailSyllabus} />
                  </section>
                )}

                {detailCourse.materials_included && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Material incluso
                    </h4>
                    <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                      {detailCourse.materials_included}
                    </p>
                  </section>
                )}

                {Array.isArray(detailCourse.tags) && detailCourse.tags.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Temas
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {detailCourse.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
                      ))}
                    </div>
                  </section>
                )}

                {/* Avaliações dos usuários */}
                {!detailCourse.id.startsWith("sd-") && <CourseRating courseId={detailCourse.id} />}
              </div>

              {/* Rodapé fixo com investimento + CTA */}
              <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <CoursePrice price={detailCourse.price_brl} promo={detailCourse.promo_price_brl} installments={detailCourse.installments} />
                </div>
                {ctaUrl(detailCourse) && (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <a href={ctaUrl(detailCourse)!} target="_blank" rel="noopener noreferrer">
                      Quero participar <ExternalLink className="w-4 h-4 ml-1.5" />
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
