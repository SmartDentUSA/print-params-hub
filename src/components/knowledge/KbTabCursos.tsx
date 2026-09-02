import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, MapPin, CalendarDays, Clock, Filter, X, UserCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import KbSearchBar from './KbSearchBar';

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
}

interface Kol {
  id: string;
  nome: string | null;
  prof_photo_url: string | null;
  especialidade: string | null;
}

const fmtDate = (d?: string | null) => {
  if (!d || d.length < 10) return null;
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
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
      const { data, error } = await (supabase as any)
        .from('lia_attendances')
        .select('id, nome, prof_photo_url, especialidade')
        .in('id', producerIds);
      if (error) throw error;
      const map: Record<string, Kol> = {};
      for (const row of (data ?? []) as Kol[]) map[row.id] = row;
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
    if (c.instagram) return `https://instagram.com/${c.instagram.replace(/^@/, '')}`;
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => {
          const kol = c.producer_lead_id ? kols[c.producer_lead_id] : undefined;
          const url = ctaUrl(c);
          const local = [c.city, c.state].filter(Boolean).join(' - ') || c.online_platform || null;
          const date = fmtDate(c.start_date);
          return (
            <article
              key={c.id}
              className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-muted overflow-hidden">
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
                    <GraduationCap className="w-10 h-10 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex flex-wrap gap-1">
                  {c.modality && <Badge variant="secondary" className="text-[11px]">{c.modality}</Badge>}
                  {c.category && <Badge variant="outline" className="text-[11px]">{c.category}</Badge>}
                  {c.featured && <Badge className="text-[11px]">Destaque</Badge>}
                </div>

                <div>
                  <h3 className="font-semibold text-foreground leading-snug line-clamp-2">{c.title}</h3>
                  {c.subtitle && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.subtitle}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {date && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {date}{c.start_time ? ` às ${c.start_time}` : ''}
                    </span>
                  )}
                  {c.workload_hours ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {c.workload_hours}h de carga horária
                    </span>
                  ) : null}
                  {local && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {local}
                    </span>
                  )}
                </div>

                {kol && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border mt-auto">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
                      {kol.prof_photo_url ? (
                        <img src={kol.prof_photo_url} alt={kol.nome ?? ''} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <UserCircle className="w-full h-full text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{kol.nome}</div>
                      {kol.especialidade && (
                        <div className="text-[11px] text-muted-foreground truncate">{kol.especialidade}</div>
                      )}
                    </div>
                  </div>
                )}

                {url && (
                  <Button asChild size="sm" className="w-full">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Quero participar <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
