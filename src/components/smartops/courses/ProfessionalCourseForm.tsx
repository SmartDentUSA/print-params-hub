import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import {
  COURSE_CATEGORIES,
  COURSE_MODALITIES,
  COURSE_STATUS,
  type ProfessionalCourseDraft,
  type ScheduleDay,
  type SyllabusModule,
} from "@/types/professionalCourses";

interface Props {
  value: ProfessionalCourseDraft;
  onChange: (patch: Partial<ProfessionalCourseDraft>) => void;
  onUploadCover?: (file: File) => void;
  uploading?: boolean;
  /** Portal do profissional esconde campos internos */
  mode?: "admin" | "portal";
}

const num = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));

export default function ProfessionalCourseForm({ value, onChange, onUploadCover, uploading, mode = "admin" }: Props) {
  const v = value;
  const isOnline = v.modality === "online_ao_vivo" || v.modality === "gravado" || v.modality === "hibrido";
  const isPresencial = v.modality === "presencial" || v.modality === "hibrido";

  const schedule: ScheduleDay[] = Array.isArray(v.schedule) ? (v.schedule as ScheduleDay[]) : [];
  const syllabus: SyllabusModule[] = Array.isArray(v.syllabus) ? (v.syllabus as SyllabusModule[]) : [];

  const setDay = (i: number, patch: Partial<ScheduleDay>) => {
    const next = schedule.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    onChange({ schedule: next });
  };
  const setModule = (i: number, patch: Partial<SyllabusModule>) => {
    const next = syllabus.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    onChange({ syllabus: next });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">1. Informações principais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Título do curso *</Label>
              <Input value={v.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Ex.: Imersão em Fluxo Digital Chairside" />
            </div>
            <div className="md:col-span-2">
              <Label>Subtítulo / chamada</Label>
              <Input value={v.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select value={v.modality ?? "presencial"} onValueChange={(x) => onChange({ modality: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURSE_MODALITIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={v.category || undefined} onValueChange={(x) => onChange({ category: x })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={4} value={v.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} placeholder="O que o aluno vai aprender, formato das aulas, diferenciais..." />
            </div>
            <div>
              <Label>Público-alvo</Label>
              <Input value={v.target_audience ?? ""} onChange={(e) => onChange({ target_audience: e.target.value })} placeholder="Ex.: dentistas clínicos gerais" />
            </div>
            <div>
              <Label>Pré-requisitos</Label>
              <Input value={v.prerequisites ?? ""} onChange={(e) => onChange({ prerequisites: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Imagem de capa (URL)</Label>
              <div className="flex gap-2">
                <Input value={v.cover_image_url ?? ""} onChange={(e) => onChange({ cover_image_url: e.target.value })} placeholder="https://..." />
                {onUploadCover && (
                  <label>
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && onUploadCover(e.target.files[0])} />
                    <Button asChild variant="outline" disabled={uploading}>
                      <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                    </Button>
                  </label>
                )}
              </div>
              {v.cover_image_url ? (
                <img src={v.cover_image_url} alt={v.title || "Capa do curso"} className="mt-2 h-28 w-full object-cover rounded-md border" />
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={(v.tags ?? []).join(", ")}
                onChange={(e) => onChange({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="chairside, resina, alinhadores"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">2. Datas, carga horária e vagas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Início</Label><Input type="date" value={v.start_date ?? ""} onChange={(e) => onChange({ start_date: e.target.value || null })} /></div>
            <div><Label>Término</Label><Input type="date" value={v.end_date ?? ""} onChange={(e) => onChange({ end_date: e.target.value || null })} /></div>
            <div><Label>Hora início</Label><Input type="time" value={v.start_time ?? ""} onChange={(e) => onChange({ start_time: e.target.value })} /></div>
            <div><Label>Hora fim</Label><Input type="time" value={v.end_time ?? ""} onChange={(e) => onChange({ end_time: e.target.value })} /></div>
            <div><Label>Dias de duração</Label><Input type="number" min={0} value={v.duration_days ?? ""} onChange={(e) => onChange({ duration_days: num(e.target.value) })} /></div>
            <div><Label>Carga horária (h)</Label><Input type="number" min={0} value={v.workload_hours ?? ""} onChange={(e) => onChange({ workload_hours: num(e.target.value) })} /></div>
            <div><Label>Vagas</Label><Input type="number" min={0} value={v.max_students ?? ""} onChange={(e) => onChange({ max_students: num(e.target.value) })} /></div>
            <div><Label>Inscritos</Label><Input type="number" min={0} value={v.enrolled_count ?? 0} onChange={(e) => onChange({ enrolled_count: num(e.target.value) ?? 0 })} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Programação por dia (opcional)</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => onChange({ schedule: [...schedule, { date: "", start_time: "", end_time: "", topic: "" }] })}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Dia
              </Button>
            </div>
            {schedule.map((d, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end border rounded-md p-2">
                <Input type="date" value={d.date ?? ""} onChange={(e) => setDay(i, { date: e.target.value })} />
                <Input type="time" value={d.start_time ?? ""} onChange={(e) => setDay(i, { start_time: e.target.value })} />
                <Input type="time" value={d.end_time ?? ""} onChange={(e) => setDay(i, { end_time: e.target.value })} />
                <Input className="md:col-span-1" placeholder="Tema" value={d.topic ?? ""} onChange={(e) => setDay(i, { topic: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" onClick={() => onChange({ schedule: schedule.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">3. Local e acesso</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isPresencial && (
            <>
              <div><Label>Cidade</Label><Input value={v.city ?? ""} onChange={(e) => onChange({ city: e.target.value })} /></div>
              <div><Label>Estado</Label><Input value={v.state ?? ""} onChange={(e) => onChange({ state: e.target.value })} /></div>
              <div><Label>País</Label><Input value={v.country ?? ""} onChange={(e) => onChange({ country: e.target.value })} /></div>
              <div><Label>Local / espaço</Label><Input value={v.venue ?? ""} onChange={(e) => onChange({ venue: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Endereço</Label><Input value={v.address ?? ""} onChange={(e) => onChange({ address: e.target.value })} /></div>
            </>
          )}
          {isOnline && (
            <>
              <div><Label>Plataforma online</Label><Input value={v.online_platform ?? ""} onChange={(e) => onChange({ online_platform: e.target.value })} placeholder="Zoom, Meet, Astron..." /></div>
              <div className="md:col-span-2"><Label>Link da sala / aulas</Label><Input value={v.meeting_link ?? ""} onChange={(e) => onChange({ meeting_link: e.target.value })} placeholder="https://..." /></div>
            </>
          )}
          <div><Label>Idioma</Label><Input value={v.language ?? ""} onChange={(e) => onChange({ language: e.target.value })} /></div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="cert" checked={!!v.certificate} onCheckedChange={(c) => onChange({ certificate: !!c })} />
            <Label htmlFor="cert" className="cursor-pointer">Emite certificado</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">4. Investimento e inscrição</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Valor (R$)</Label><Input type="number" min={0} step="0.01" value={v.price_brl ?? ""} onChange={(e) => onChange({ price_brl: num(e.target.value) })} /></div>
          <div><Label>Valor promocional (R$)</Label><Input type="number" min={0} step="0.01" value={v.promo_price_brl ?? ""} onChange={(e) => onChange({ promo_price_brl: num(e.target.value) })} /></div>
          <div><Label>Parcelas</Label><Input type="number" min={1} value={v.installments ?? ""} onChange={(e) => onChange({ installments: num(e.target.value) })} /></div>
          <div className="md:col-span-2"><Label>Link de inscrição / checkout</Label><Input value={v.registration_url ?? ""} onChange={(e) => onChange({ registration_url: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Plataforma de venda</Label><Input value={v.course_platform ?? ""} onChange={(e) => onChange({ course_platform: e.target.value })} placeholder="Hotmart, Kiwify..." /></div>
          <div>
            <Label>WhatsApp do curso</Label>
            <div className="flex gap-2">
              <Input className="w-20" value={v.whatsapp_ddi ?? "55"} onChange={(e) => onChange({ whatsapp_ddi: e.target.value })} />
              <Input value={v.whatsapp_number ?? ""} onChange={(e) => onChange({ whatsapp_number: e.target.value })} placeholder="DDD + número" />
            </div>
          </div>
          <div><Label>Instagram</Label><Input value={v.instagram ?? ""} onChange={(e) => onChange({ instagram: e.target.value })} placeholder="@perfil" /></div>
          <div><Label>Vídeo de apresentação</Label><Input value={v.video_url ?? ""} onChange={(e) => onChange({ video_url: e.target.value })} placeholder="YouTube / Panda" /></div>
          <div className="md:col-span-3"><Label>Materiais inclusos</Label><Textarea rows={2} value={v.materials_included ?? ""} onChange={(e) => onChange({ materials_included: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">5. Conteúdo programático</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {syllabus.map((m, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder={`Módulo ${i + 1}`} value={m.title ?? ""} onChange={(e) => setModule(i, { title: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" onClick={() => onChange({ syllabus: syllabus.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                rows={3}
                placeholder="Um tópico por linha"
                value={(m.items ?? []).join("\n")}
                onChange={(e) => setModule(i, { items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ syllabus: [...syllabus, { title: "", items: [] }] })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Módulo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">6. Publicação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Situação</Label>
            <Select value={v.status ?? "rascunho"} onValueChange={(x) => onChange({ status: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COURSE_STATUS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pub" checked={!!v.public_visible} onCheckedChange={(c) => onChange({ public_visible: !!c })} />
            <Label htmlFor="pub" className="cursor-pointer">Visível publicamente</Label>
          </div>
          {mode === "admin" && (
            <div className="flex items-center gap-2">
              <Checkbox id="feat" checked={!!v.featured} onCheckedChange={(c) => onChange({ featured: !!c })} />
              <Label htmlFor="feat" className="cursor-pointer">Destaque</Label>
            </div>
          )}
          {mode === "admin" && (
            <div className="md:col-span-3">
              <Label>Notas internas (não aparecem para o profissional)</Label>
              <Textarea rows={2} value={v.internal_notes ?? ""} onChange={(e) => onChange({ internal_notes: e.target.value })} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}