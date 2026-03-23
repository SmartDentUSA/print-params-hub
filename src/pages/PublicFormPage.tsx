import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { PhoneInputWithDDI } from "@/components/PhoneInputWithDDI";
import { Slider } from "@/components/ui/slider";

interface FormField {
  id: string;
  label: string;
  field_type: string;
  db_column: string | null;
  custom_field_name: string | null;
  options: any;
  required: boolean;
  placeholder: string | null;
  order_index: number;
  workflow_cell_target: string | null;
}

interface FormData {
  id: string;
  name: string;
  slug: string;
  form_purpose: string;
  theme_color: string | null;
  success_message: string | null;
  success_redirect_url: string | null;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  media_type: string | null;
  video_thumbnail_url: string | null;
  video_embed_url: string | null;
  workflow_stage_target: string | null;
  brand_color_h: number | null;
  brand_color_s: number | null;
  brand_color_l: number | null;
}

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormData | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: formData } = await supabase
        .from("smartops_forms" as any)
        .select("*")
        .eq("slug", slug)
        .single();

      if (!formData) {
        setError("Formulário não encontrado.");
        setLoading(false);
        return;
      }
      if (!(formData as any).active) {
        setError("Formulário temporariamente indisponível.");
        setLoading(false);
        return;
      }
      setForm(formData as any);

      const { data: fieldsData } = await supabase
        .from("smartops_form_fields" as any)
        .select("*")
        .eq("form_id", (formData as any).id)
        .order("order_index");

      if (fieldsData) setFields(fieldsData as any);
      setLoading(false);
    };
    load();
  }, [slug]);

  // OG image meta tag
  useEffect(() => {
    if (!form) return;
    const ogImage =
      form.media_type === "video" ? form.video_thumbnail_url : form.hero_image_url;
    if (!ogImage) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", ogImage);
    return () => {
      meta?.removeAttribute("content");
    };
  }, [form]);

  // Adaptive color palette — apply brand_color_h/s/l as CSS vars
  useEffect(() => {
    if (!form) return;
    const h = form.brand_color_h ?? 215;
    const s = form.brand_color_s ?? 78;
    const l = form.brand_color_l ?? 54;
    const root = document.documentElement;
    root.style.setProperty('--brand-h', String(h));
    root.style.setProperty('--brand-s', `${s}%`);
    root.style.setProperty('--brand-l', `${l}%`);
    return () => {
      root.style.removeProperty('--brand-h');
      root.style.removeProperty('--brand-s');
      root.style.removeProperty('--brand-l');
    };
  }, [form?.brand_color_h, form?.brand_color_s, form?.brand_color_l]);

  const handleChange = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);

    // Build payload mapping db_column -> value, custom fields -> raw_payload
    const payload: Record<string, any> = {
      source: "form",
      form_name: form.name,
      form_purpose: form.form_purpose,
    };

    const customFields: Record<string, any> = {};

    for (const field of fields) {
      const val = values[field.id];
      if (!val && field.required) {
        toast_inline(`Campo "${field.label}" é obrigatório.`);
        setSubmitting(false);
        return;
      }
      if (!val) continue;

      if (field.db_column) {
        payload[field.db_column] = val;
      } else if (field.custom_field_name) {
        customFields[field.custom_field_name] = val;
      }
    }

    // UTMs from URL
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term"];
    for (const key of utmKeys) {
      const v = searchParams.get(key);
      if (v) payload[key] = v;
    }

    if (Object.keys(customFields).length > 0) {
      payload.raw_payload = { custom_fields: customFields };
    }

    // Ensure required email field
    if (!payload.email) {
      payload.email = `form-${Date.now()}@no-email.com`;
    }
    if (!payload.nome) {
      payload.nome = "Anônimo";
    }

    try {
      const { data: ingestData, error } = await supabase.functions.invoke("smart-ops-ingest-lead", {
        body: payload,
      });
      if (error) throw error;

      // Increment submissions count
      await supabase.from("smartops_forms" as any)
        .update({ submissions_count: (form as any).submissions_count + 1 } as any)
        .eq("id", form.id);

      // Gravar respostas dos campos de mapeamento
      const leadId = ingestData?.lead_id;
      if (form.form_purpose === "sdr_captacao" && leadId) {
        const mappingFields = fields.filter((f) => f.workflow_cell_target);
        if (mappingFields.length > 0) {
          const responses = mappingFields
            .map((f) => {
              const raw = values[f.id];
              if (raw === undefined || raw === null || raw === "") return null;
              const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
              return {
                form_id: form.id,
                field_id: f.id,
                lead_id: leadId,
                value,
                workflow_cell_target: f.workflow_cell_target,
              };
            })
            .filter(Boolean);

          if (responses.length > 0) {
            supabase
              .from("smartops_form_field_responses" as any)
              .insert(responses as any)
              .then(({ error: respError }: { error: any }) => {
                if (respError) console.error("[PublicFormPage] Erro ao gravar field responses:", respError);
              });
          }
        }
      }

      // GTM — Lead gerado via formulário SDR-CAPTAÇÃO
      try {
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: 'generate_lead',
            form_name: form.name ?? '',
            form_purpose: form.form_purpose ?? '',
            product_name: form.workflow_stage_target ?? '',
          });
        }
      } catch (e) {
        console.error('GTM dataLayer error:', e);
      }

      // Redirect if URL configured
      const redirectUrl = (form as any).success_redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      toast_inline(`Erro ao enviar: ${err.message || "tente novamente"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Simple inline toast
  const [inlineError, setInlineError] = useState<string | null>(null);
  const toast_inline = (msg: string) => {
    setInlineError(msg);
    setTimeout(() => setInlineError(null), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive">{error || "Formulário não encontrado"}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: 'var(--brand, #3b82f6)' }} />
          <p className="text-lg font-medium">{form.success_message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-form-page min-h-screen bg-background flex items-start justify-center p-4 pt-8 md:pt-16">
      <style>{`
        :root {
          --brand-h: 215;
          --brand-s: 78%;
          --brand-l: 54%;
        }
        .public-form-page {
          --brand:       hsl(var(--brand-h), var(--brand-s), var(--brand-l));
          --brand-dark:  hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 12%));
          --brand-glow:  hsl(var(--brand-h), 90%,            calc(var(--brand-l) + 14%));
          --brand-faint: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
          --brand-border:hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.28);
        }
        .public-form-page .brand-strip {
          background: var(--brand);
        }
        .public-form-page .brand-btn {
          background: var(--brand);
          border-color: var(--brand-dark);
        }
        .public-form-page .brand-btn:hover {
          background: var(--brand-dark);
        }
        .public-form-page input:focus,
        .public-form-page select:focus,
        .public-form-page textarea:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--brand-faint), 0 0 0 1px var(--brand-border);
          border-color: var(--brand);
        }
        .public-form-page .video-glow {
          box-shadow: 0 0 32px var(--brand-faint);
        }
      `}</style>
      {/* Brand color strip */}
      <div className="brand-strip fixed top-0 left-0 right-0 h-1 z-50" />
      <div className="w-full max-w-lg mt-1">
        {/* Mídia HERO */}
        {form.media_type === "video" && form.video_embed_url && (
          <div className="video-glow w-full mb-6 rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={form.video_embed_url}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; encrypted-media"
              style={{ border: 0 }}
            />
          </div>
        )}
        {form.media_type === "video" && !form.video_embed_url && form.video_thumbnail_url && (
          <img
            src={form.video_thumbnail_url}
            alt={form.hero_image_alt ?? ""}
            className="w-full rounded-lg object-cover mb-6"
          />
        )}
        {form.media_type !== "video" && form.hero_image_url && (
          <img
            src={form.hero_image_url}
            alt={form.hero_image_alt ?? ""}
            className="w-full rounded-lg object-cover mb-6"
          />
        )}

        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold">{form.title || form.name}</h1>
          {form.subtitle && (
            <p className="text-lg text-muted-foreground">{form.subtitle}</p>
          )}
          {form.description && (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.field_type === "text" && (
                <Input
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "email" && (
                <Input
                  type="email"
                  placeholder={field.placeholder || "email@exemplo.com"}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "phone" && (
                <PhoneInputWithDDI
                  placeholder={field.placeholder || "(11) 99999-9999"}
                  value={values[field.id] || ""}
                  onChange={(val) => handleChange(field.id, val)}
                  required={field.required}
                />
              )}

              {field.field_type === "number" && (
                <Input
                  type="number"
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "textarea" && (
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[100px] bg-background border-input"
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "select" && (
                <select
                  className="w-full border rounded-md p-2 text-sm bg-background border-input"
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                >
                  <option value="">{field.placeholder || "Selecione..."}</option>
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.field_type === "radio" && (
                <div className="space-y-2">
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`field-${field.id}`}
                        value={opt}
                        checked={values[field.id] === opt}
                        onChange={() => handleChange(field.id, opt)}
                        required={field.required && !values[field.id]}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === "checkbox" && (
                <div className="space-y-2">
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(values[field.id] || []).includes(opt)}
                        onChange={(e) => {
                          const current = values[field.id] || [];
                          handleChange(
                            field.id,
                            e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt)
                          );
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === "slider" && (() => {
                const opts = (field.options && !Array.isArray(field.options)) ? field.options as Record<string, any> : {};
                const min = opts.min ?? 0;
                const mid = opts.mid ?? 50;
                const max = opts.max ?? 100;
                const current = values[field.id] ?? mid;
                return (
                  <div className="space-y-3 pt-2">
                    <Slider
                      min={min}
                      max={max}
                      step={1}
                      value={[current]}
                      onValueChange={([v]) => handleChange(field.id, v)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{min}</span>
                      <span>{mid}</span>
                      <span>{max}</span>
                    </div>
                    <p className="text-sm font-medium text-center">Valor: {current}</p>
                  </div>
                );
              })()}
            </div>
          ))}

          {inlineError && (
            <p className="text-sm text-destructive">{inlineError}</p>
          )}

          <Button
            type="submit"
            className="brand-btn w-full"
            disabled={submitting}
            style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand-dark)' }}
          >
            {submitting ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
