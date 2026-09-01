import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, Trash2 } from "lucide-react";
import CoverImageUpload from "@/components/smartops/CoverImageUpload";

export type EventSpeakerSession = { date?: string; start_time?: string; end_time?: string };
export type EventSpeaker = {
  name?: string;
  theme?: string;
  instagram?: string;
  photo_url?: string;
  sessions?: EventSpeakerSession[];
};
export type EventPartnerBrand = { name?: string; instagram?: string };

/** Normaliza @handle (sem URL, sem @ duplicado). */
export function normalizeHandle(v?: string | null): string {
  const raw = String(v || "").trim();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "");
  return cleaned ? `@${cleaned}` : "";
}

export default function EventSpeakersFields({
  speakers,
  partnerBrands,
  instagramHandle,
  onChange,
}: {
  speakers: EventSpeaker[];
  partnerBrands: EventPartnerBrand[];
  instagramHandle?: string | null;
  onChange: (patch: {
    speakers?: EventSpeaker[];
    partner_brands?: EventPartnerBrand[];
    instagram_handle?: string;
  }) => void;
}) {
  const list = speakers || [];
  const brands = partnerBrands || [];

  const patchSpeaker = (i: number, patch: Partial<EventSpeaker>) =>
    onChange({ speakers: list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const patchSession = (i: number, si: number, patch: Partial<EventSpeakerSession>) =>
    patchSpeaker(i, {
      sessions: (list[i].sessions || []).map((s, idx) => (idx === si ? { ...s, ...patch } : s)),
    });

  return (
    <div className="space-y-4 border rounded-md p-3">
      <div>
        <Label className="text-sm font-semibold">Instagram do evento</Label>
        <Input
          value={instagramHandle || ""}
          onChange={(e) => onChange({ instagram_handle: e.target.value })}
          onBlur={(e) => onChange({ instagram_handle: normalizeHandle(e.target.value) })}
          placeholder="@congresso_exemplo"
        />
        <p className="text-[11px] text-muted-foreground pt-1">
          Usado nas copies de redes sociais para marcar o perfil oficial do congresso.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Palestrantes / demonstrações</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ speakers: [...list, { sessions: [{}] }] })}
          >
            <Plus className="h-4 w-4 mr-1" /> Palestrante
          </Button>
        </div>

        {list.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum palestrante cadastrado.</p>
        )}

        {list.map((sp, i) => (
          <div key={i} className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="secondary">Palestrante {i + 1}</Badge>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onChange({ speakers: list.filter((_, idx) => idx !== i) })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={sp.name || ""}
                  onChange={(e) => patchSpeaker(i, { name: e.target.value })}
                  placeholder="Dr. Nome Sobrenome"
                />
              </div>
              <div>
                <Label className="text-xs">@Instagram</Label>
                <Input
                  value={sp.instagram || ""}
                  onChange={(e) => patchSpeaker(i, { instagram: e.target.value })}
                  onBlur={(e) => patchSpeaker(i, { instagram: normalizeHandle(e.target.value) })}
                  placeholder="@dr.nome"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Tema da demonstração</Label>
              <Input
                value={sp.theme || ""}
                onChange={(e) => patchSpeaker(i, { theme: e.target.value })}
                placeholder="Ex: Fluxo digital chairside em coroa unitária"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Datas e horários</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => patchSpeaker(i, { sessions: [...(sp.sessions || []), {}] })}
                >
                  <Plus className="h-3 w-3 mr-1" /> data / horário
                </Button>
              </div>
              {(sp.sessions || []).map((se, si) => (
                <div key={si} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Data</Label>
                    <Input
                      type="date"
                      value={se.date || ""}
                      onChange={(e) => patchSession(i, si, { date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Início</Label>
                    <Input
                      type="time"
                      value={se.start_time || ""}
                      onChange={(e) => patchSession(i, si, { start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input
                      type="time"
                      value={se.end_time || ""}
                      onChange={(e) => patchSession(i, si, { end_time: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      patchSpeaker(i, { sessions: (sp.sessions || []).filter((_, idx) => idx !== si) })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!(sp.sessions || []).length && (
                <p className="text-[11px] text-muted-foreground">Nenhuma data adicionada.</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Foto do palestrante</Label>
              <CoverImageUpload
                value={sp.photo_url || ""}
                onChange={(url) => patchSpeaker(i, { photo_url: url })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Marcas parceiras</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ partner_brands: [...brands, {}] })}
          >
            <Plus className="h-4 w-4 mr-1" /> Marca
          </Button>
        </div>
        {brands.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma marca parceira cadastrada.</p>
        )}
        {brands.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-[10px] text-muted-foreground">Marca</Label>
              <Input
                value={b.name || ""}
                onChange={(e) =>
                  onChange({ partner_brands: brands.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)) })
                }
                placeholder="Ex: Rayshape"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">@Instagram</Label>
              <Input
                value={b.instagram || ""}
                onChange={(e) =>
                  onChange({
                    partner_brands: brands.map((x, idx) => (idx === i ? { ...x, instagram: e.target.value } : x)),
                  })
                }
                onBlur={(e) =>
                  onChange({
                    partner_brands: brands.map((x, idx) =>
                      idx === i ? { ...x, instagram: normalizeHandle(e.target.value) } : x,
                    ),
                  })
                }
                placeholder="@rayshape3d"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onChange({ partner_brands: brands.filter((_, idx) => idx !== i) })}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
