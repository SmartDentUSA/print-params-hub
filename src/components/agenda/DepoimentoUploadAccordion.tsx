import { useRef, useState } from "react";
import { Loader2, Search, UploadCloud, CheckCircle2, Phone, MapPin, Stethoscope, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { prepareUpload, runUpload, readDimensions, resolvedMimeType } from "@/lib/trainingDriveUpload";

interface TrainingOption {
  turma_id: string;
  turma_number: number | null;
  turma_label: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  enrollment_id: string | null;
  companion_id: string | null;
  participant_name: string | null;
  has_depoimentos_folder: boolean;
}

interface ClientResult {
  found: boolean;
  error?: string;
  lead_id?: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  especialidade?: string | null;
  empresa_nome?: string | null;
  trainings?: TrainingOption[];
  equipamentos?: string[];
}

function fmtPhone(raw?: string | null): string {
  const d = String(raw || "").replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw || "—";
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function DepoimentoUploadAccordion() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<ClientResult | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentFiles, setSentFiles] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = client?.trainings?.find((t) => t.turma_id === turmaId) || null;

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setClient(null);
    setTurmaId(null);
    setSentFiles([]);
    try {
      const { data, error: rpcErr } = await (supabase as any)
        .rpc("fn_search_testimonial_client", { p_query: q });
      if (rpcErr) throw rpcErr;
      const res = data as ClientResult;
      if (!res?.found) {
        setError(res?.error || "Cliente não encontrado. Tente o e-mail, o celular ou o ID do negócio.");
        return;
      }
      setClient(res);
      const list = res.trainings || [];
      const firstUsable = list.find((t) => t.has_depoimentos_folder) || list[0];
      setTurmaId(firstUsable?.turma_id ?? null);
      if (!list.length) {
        setError("Cliente localizado, mas sem treinamento vinculado. Registre a inscrição antes de enviar o depoimento.");
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSearching(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !selected || !client) return;
    if (!selected.has_depoimentos_folder) {
      toast({
        title: "Pasta de depoimentos indisponível",
        description: "Esta turma ainda não tem a pasta do Drive provisionada.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        const dims = await readDimensions(file);
        const prepared = await prepareUpload({
          turma_id: selected.turma_id,
          destination_key: "videos_depoimentos",
          original_filename: file.name,
          mime_type: resolvedMimeType(file),
          size_bytes: file.size,
          width: dims.width,
          height: dims.height,
          enrollment_id: selected.enrollment_id,
          companion_id: selected.companion_id,
          exception_reason: selected.enrollment_id || selected.companion_id
            ? null
            : `Depoimento recebido por canal externo — ${client.nome || "cliente"}`,
        });
        await runUpload(file, prepared, (sent) => setProgress(Math.round((sent / file.size) * 100)));
        setSentFiles((prev) => [...prev, prepared.generated_filename || file.name]);
      }
      toast({
        title: "Depoimento enviado",
        description: "Entrou no pipeline: transcrição, artigo na Base de Conhecimento e publicação nas redes.",
      });
    } catch (err: any) {
      toast({ title: "Falha no envio", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Accordion type="single" collapsible className="mb-8 rounded-xl border bg-card">
      <AccordionItem value="depoimentos" className="border-none">
        <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
          <span className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" />
            Upload de depoimentos
            <Badge variant="secondary" className="text-[10px] font-normal">equipe</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <p className="mb-3 text-[12px] text-muted-foreground">
            Envie depoimentos recebidos por WhatsApp ou outro canal. Busque o cliente por e-mail, celular
            ou ID do negócio, confirme a ficha e envie o vídeo — o pipeline de publicação segue igual.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
              placeholder="E-mail, celular ou ID do negócio"
              className="h-9 text-sm"
            />
            <Button onClick={() => void search()} disabled={searching || !query.trim()} className="h-9 gap-1.5">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar cliente
            </Button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-destructive">
              {error}
            </div>
          )}

          {client?.found && (
            <div className="mt-4 space-y-3 rounded-lg border p-3">
              <div className="text-sm font-semibold">{client.nome || "Cliente sem nome"}</div>
              <div className="grid gap-1.5 text-[12px] text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{fmtPhone(client.telefone)}</span>
                <span className="truncate">{client.email || "sem e-mail"}</span>
                {(client.cidade || client.estado) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />{[client.cidade, client.estado].filter(Boolean).join(" / ")}
                  </span>
                )}
                {client.especialidade && (
                  <span className="flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" />{client.especialidade}</span>
                )}
              </div>

              {(client.equipamentos?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium">
                    <Package className="h-3.5 w-3.5" /> Equipamentos comprados
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {client.equipamentos!.slice(0, 12).map((e) => (
                      <Badge key={e} variant="outline" className="text-[10px] font-normal">{e}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {(client.trainings?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium">Treinamento do depoimento</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {client.trainings!.map((t) => (
                      <button
                        key={t.turma_id}
                        type="button"
                        onClick={() => setTurmaId(t.turma_id)}
                        className={`rounded-lg border p-2 text-left text-[11px] transition ${
                          turmaId === t.turma_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium text-foreground">
                          {t.course_title || t.turma_label || "Turma"}
                          {t.turma_number ? ` · T${t.turma_number}` : ""}
                        </div>
                        <div className="text-muted-foreground">
                          {fmtDate(t.start_date)}{t.end_date && t.end_date !== t.start_date ? ` a ${fmtDate(t.end_date)}` : ""}
                        </div>
                        {!t.has_depoimentos_folder && (
                          <div className="text-destructive">pasta do Drive não provisionada</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void upload(e.target.files)}
                />
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={uploading || !selected}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading ? "Enviando…" : "Selecionar vídeo do depoimento"}
                </Button>
                {selected?.participant_name && (
                  <span className="text-[11px] text-muted-foreground">
                    será publicado como <strong>{selected.participant_name}</strong>
                  </span>
                )}
              </div>

              {uploading && <Progress value={progress} className="h-1.5" />}

              {sentFiles.length > 0 && (
                <div className="space-y-1">
                  {sentFiles.map((f) => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {f} · no pipeline de publicação
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}