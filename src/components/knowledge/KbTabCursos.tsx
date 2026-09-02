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
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import KbSearchBar from './KbSearchBar';

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
  online_platform: string | null;
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
      return (data ?? []) as ProfCourse[];
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
      const [{ data: rows, error: err1 }, { data: mirrors, error: err2 }] = await Promise.all([
        (supabase as any)
          .from('lia_attendances')
          .select('id, nome, prof_photo_url, especialidade, instagram, prof_mini_cv')
          .in('id', producerIds),
        (supabase as any)
          .from('piperun_persons_mirror')
          .select('lia_attendance_id, cliente_desde')
          .in('lia_attendance_id', producerIds)
          .order('created_at', { ascending: false }),
      ]);
      if (err1) throw err1;
      if (err2) throw err2;

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
    if (c.registration_url) return c.registration_url;
    if (c.whatsapp_number) {
      const digits = `${c.whatsapp_ddi ?? '55'}${c.whatsapp_number}`.replace(/\D/g, '');
      return `https://wa.me/${digits}?text=${encodeURIComponent(`Olá! Tenho interesse no curso "${c.title}".`)}`;
    }
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
    <div>
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

      <div className="flex flex-col gap-8">
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
              <section key={producerId} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                {/* Identificação do profissional no topo do card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-card">
                  {/* Coluna 1: Foto + Nome */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-muted shrink-0 ring-2 ring-primary/10">
                      {kol?.prof_photo_url ? (
                        <img
                          src={kol.prof_photo_url}
                          alt={kol.nome ?? 'Profissional'}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-full h-full text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground truncate">
                        {kol?.nome ?? 'Smart Dent'}
                      </p>
                      {handle && (
                        <a
                          href={`https://instagram.com/${handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Instagram className="w-3.5 h-3.5" /> @{handle}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Coluna 2: Especialidade + Mini CV + Cliente desde */}
                  <div className="flex flex-col gap-2 min-w-0">
                    {kol?.especialidade && (
                      <p className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        {kol.especialidade}
                      </p>
                    )}
                    {kol?.prof_mini_cv && (
                      <p className="text-sm text-muted-foreground line-clamp-4">
                        {kol.prof_mini_cv}
                      </p>
                    )}
                    {kol?.cliente_desde && (
                      <p className="text-xs text-muted-foreground">
                        Clientes Smart Dent desde: {fmtDate(kol.cliente_desde)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cursos incrementais abaixo da foto, no mesmo card */}
                <div className="border-t border-border bg-background/50">
                  {list.map((c, idx) => {
                    const local = [c.city, c.state].filter(Boolean).join(' - ') || c.online_platform || null;
                    const date = fmtDate(c.start_date);
                    return (
                      <article
                        key={c.id}
                        className={`flex flex-col sm:flex-row gap-4 p-4 hover:bg-accent/40 transition-colors ${
                          idx !== list.length - 1 ? 'border-b border-border' : ''
                        }`}
                      >
                        <div className="sm:w-40 shrink-0">
                          <div className="aspect-video sm:aspect-square rounded-lg bg-muted overflow-hidden">
                            {c.cover_image_url ? (
                              <img
                                src={c.cover_image_url}
                                alt={c.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <GraduationCap className="w-8 h-8 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1">
                            {c.modality && <Badge variant="secondary" className="text-[11px]">{c.modality}</Badge>}
                            {c.category && <Badge variant="outline" className="text-[11px]">{c.category}</Badge>}
                            {c.featured && <Badge className="text-[11px]">Destaque</Badge>}
                          </div>

                          <div>
                            <h4 className="font-semibold text-foreground leading-snug">{c.title}</h4>
                            {c.subtitle && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{c.subtitle}</p>
                            )}
                          </div>

                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {date && (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {date}{c.start_time ? ` às ${c.start_time}` : ''}
                              </span>
                            )}
                            {c.workload_hours ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> {c.workload_hours}h
                              </span>
                            ) : null}
                            {local && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" /> {local}
                              </span>
                            )}
                          </div>

                          <div className="mt-auto pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => setDetail({ course: c, kol })}
                            >
                              <Info className="w-3.5 h-3.5 mr-1.5" /> Informações do curso
                            </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg leading-snug">{detailCourse.title}</DialogTitle>
                {detailCourse.subtitle && (
                  <DialogDescription>{detailCourse.subtitle}</DialogDescription>
                )}
              </DialogHeader>

              {detailCourse.cover_image_url && (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  <img
                    src={detailCourse.cover_image_url}
                    alt={detailCourse.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              {detail?.kol && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                    {detail.kol.prof_photo_url ? (
                      <img src={detail.kol.prof_photo_url} alt={detail.kol.nome ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-full h-full text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{detail.kol.nome}</div>
                    {igHandle(detail.kol.instagram) && (
                      <a
                        href={`https://instagram.com/${igHandle(detail.kol.instagram)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Instagram className="w-3 h-3" /> @{igHandle(detail.kol.instagram)}
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {detailCourse.modality && <Badge variant="secondary">{detailCourse.modality}</Badge>}
                {detailCourse.category && <Badge variant="outline">{detailCourse.category}</Badge>}
                {detailCourse.certificate && <Badge variant="outline">Com certificado</Badge>}
              </div>

              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                {fmtDate(detailCourse.start_date) && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" />
                    {fmtDate(detailCourse.start_date)}
                    {detailCourse.end_date && detailCourse.end_date !== detailCourse.start_date
                      ? ` a ${fmtDate(detailCourse.end_date)}`
                      : ''}
                    {detailCourse.start_time ? ` às ${detailCourse.start_time}` : ''}
                  </span>
                )}
                {detailCourse.workload_hours ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {detailCourse.workload_hours}h de carga horária
                  </span>
                ) : null}
                {([detailCourse.city, detailCourse.state].filter(Boolean).join(' - ') || detailCourse.online_platform) && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {[detailCourse.city, detailCourse.state].filter(Boolean).join(' - ') || detailCourse.online_platform}
                  </span>
                )}
              </div>

              {detailCourse.description && (
                <section>
                  <h4 className="text-sm font-semibold mb-1">Descrição</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{detailCourse.description}</p>
                </section>
              )}

              {detailCourse.target_audience && (
                <section>
                  <h4 className="text-sm font-semibold mb-1">Público-alvo</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{detailCourse.target_audience}</p>
                </section>
              )}

              {detailCourse.prerequisites && (
                <section>
                  <h4 className="text-sm font-semibold mb-1">Pré-requisitos</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{detailCourse.prerequisites}</p>
                </section>
              )}

              {detailSyllabus.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold mb-2">Conteúdo programático</h4>
                  <div className="flex flex-col gap-3">
                    {detailSyllabus.map((mod, i) => (
                      <div key={i}>
                        {mod?.title && <div className="text-sm font-medium">{mod.title}</div>}
                        {Array.isArray(mod?.items) && mod.items.length > 0 && (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {mod.items.map((it, j) => (
                              <li key={j}>{it}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailCourse.materials_included && (
                <section>
                  <h4 className="text-sm font-semibold mb-1">Material incluso</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{detailCourse.materials_included}</p>
                </section>
              )}

              {(detailPrice || detailPromo || detailCourse.installments) && (
                <section className="rounded-lg border border-border p-3">
                  <h4 className="text-sm font-semibold mb-1">Investimento e inscrição</h4>
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    {detailPromo ? (
                      <>
                        <span className="text-lg font-semibold text-foreground">{detailPromo}</span>
                        {detailPrice && <span className="text-muted-foreground line-through">{detailPrice}</span>}
                      </>
                    ) : (
                      detailPrice && <span className="text-lg font-semibold text-foreground">{detailPrice}</span>
                    )}
                    {detailCourse.installments ? (
                      <span className="text-muted-foreground">em até {detailCourse.installments}x</span>
                    ) : null}
                  </div>
                </section>
              )}

              {ctaUrl(detailCourse) && (
                <Button asChild className="w-full">
                  <a href={ctaUrl(detailCourse)!} target="_blank" rel="noopener noreferrer">
                    Quero participar <ExternalLink className="w-4 h-4 ml-1.5" />
                  </a>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
