import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, ArrowRight } from "lucide-react";
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
  badge_text: string | null;
  cta_text: string | null;
  trust_text: string | null;
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
  const [inlineError, setInlineError] = useState<string | null>(null);

  const toast_inline = (msg: string) => {
    setInlineError(msg);
    setTimeout(() => setInlineError(null), 4000);
  };

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
    return () => { meta?.removeAttribute("content"); };
  }, [form]);

  // Adaptive color palette — apply brand_color_h/s/l as CSS vars on :root
  useEffect(() => {
    if (!form) return;
    const h = form.brand_color_h ?? 215;
    const s = form.brand_color_s ?? 78;
    const l = form.brand_color_l ?? 54;
    const root = document.documentElement;
    root.style.setProperty("--brand-h", String(h));
    root.style.setProperty("--brand-s", `${s}%`);
    root.style.setProperty("--brand-l", `${l}%`);
    return () => {
      root.style.removeProperty("--brand-h");
      root.style.removeProperty("--brand-s");
      root.style.removeProperty("--brand-l");
    };
  }, [form?.brand_color_h, form?.brand_color_s, form?.brand_color_l]);

  const handleChange = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);

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

    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term"];
    for (const key of utmKeys) {
      const v = searchParams.get(key);
      if (v) payload[key] = v;
    }

    if (Object.keys(customFields).length > 0) {
      payload.raw_payload = { custom_fields: customFields };
    }
    if (!payload.email) payload.email = `form-${Date.now()}@no-email.com`;
    if (!payload.nome) payload.nome = "Anônimo";

    try {
      const { data: ingestData, error } = await supabase.functions.invoke(
        "smart-ops-ingest-lead",
        { body: payload }
      );
      if (error) throw error;

      await supabase
        .from("smartops_forms" as any)
        .update({ submissions_count: (form as any).submissions_count + 1 } as any)
        .eq("id", form.id);

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
                if (respError)
                  console.error("[PublicFormPage] Erro ao gravar field responses:", respError);
              });
          }
        }
      }

      try {
        if (typeof window !== "undefined" && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: "generate_lead",
            form_name: form.name ?? "",
            form_purpose: form.form_purpose ?? "",
            product_name: form.workflow_stage_target ?? "",
          });
        }
      } catch (e) {
        console.error("GTM dataLayer error:", e);
      }

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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          background: "#060810",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Carregando...</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div
        style={{
          background: "#060810",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#f87171" }}>{error || "Formulário não encontrado"}</p>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--brand-h,215), 55%, 7%) 0%, hsl(var(--brand-h,215), 35%, 4%) 60%, hsl(270, 25%, 5%) 100%)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <CheckCircle
            style={{
              width: "4rem",
              height: "4rem",
              margin: "0 auto 1rem",
              color: `hsl(var(--brand-h, 215), var(--brand-s, 78%), var(--brand-l, 54%))`,
            }}
          />
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.125rem", fontWeight: 500 }}>
            {form.success_message}
          </p>
        </div>
      </div>
    );
  }

  // ── Group adjacent email + phone into 2-column pairs ──────────────────────
  const fieldGroups: Array<FormField | [FormField, FormField]> = [];
  const isEmailOrPhone = (f: FormField) =>
    f.field_type === "email" || f.field_type === "phone";
  let gi = 0;
  while (gi < fields.length) {
    const curr = fields[gi];
    const next = fields[gi + 1];
    if (
      isEmailOrPhone(curr) &&
      next &&
      isEmailOrPhone(next) &&
      curr.field_type !== next.field_type
    ) {
      fieldGroups.push([curr, next] as [FormField, FormField]);
      gi += 2;
    } else {
      fieldGroups.push(curr);
      gi++;
    }
  }

  // ── Render a single field control ─────────────────────────────────────────
  const renderInput = (field: FormField) => {
    if (field.field_type === "text") {
      return (
        <Input
          placeholder={field.placeholder || ""}
          value={values[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
        />
      );
    }
    if (field.field_type === "email") {
      return (
        <Input
          type="email"
          placeholder={field.placeholder || "email@exemplo.com"}
          value={values[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
        />
      );
    }
    if (field.field_type === "phone") {
      return (
        <PhoneInputWithDDI
          placeholder={field.placeholder || "(11) 99999-9999"}
          value={values[field.id] || ""}
          onChange={(val) => handleChange(field.id, val)}
          required={field.required}
        />
      );
    }
    if (field.field_type === "number") {
      return (
        <Input
          type="number"
          placeholder={field.placeholder || ""}
          value={values[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
        />
      );
    }
    if (field.field_type === "textarea") {
      return (
        <textarea
          className="w-full border rounded-md p-2 text-sm min-h-[100px]"
          placeholder={field.placeholder || ""}
          value={values[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
        />
      );
    }
    if (field.field_type === "select") {
      return (
        <select
          className="w-full border rounded-md p-2 text-sm"
          value={values[field.id] || ""}
          onChange={(e) => handleChange(field.id, e.target.value)}
          required={field.required}
        >
          <option value="">{field.placeholder || "Selecione..."}</option>
          {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.field_type === "radio") {
      return (
        <div className="space-y-2">
          {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
              }}
            >
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
      );
    }
    if (field.field_type === "checkbox") {
      return (
        <div className="space-y-2">
          {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={(values[field.id] || []).includes(opt)}
                onChange={(e) => {
                  const current = values[field.id] || [];
                  handleChange(
                    field.id,
                    e.target.checked
                      ? [...current, opt]
                      : current.filter((v: string) => v !== opt)
                  );
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    if (field.field_type === "slider") {
      const opts =
        field.options && !Array.isArray(field.options)
          ? (field.options as Record<string, any>)
          : {};
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span>{min}</span>
            <span>{mid}</span>
            <span>{max}</span>
          </div>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              textAlign: "center",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            Valor: {current}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderFieldCell = (field: FormField) => (
    <div className="space-y-1.5">
      <Label
        style={{
          color: "rgba(255,255,255,0.55)",
          fontSize: "0.7rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {field.label}
        {field.required && (
          <span style={{ color: "#f87171", marginLeft: "0.25rem" }}>*</span>
        )}
      </Label>
      {renderInput(field)}
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="public-form-page min-h-screen flex items-center justify-center p-4 py-10">
      <style>{`
        :root {
          --brand-h: 215;
          --brand-s: 78%;
          --brand-l: 54%;
        }
        .public-form-page {
          --brand:        hsl(var(--brand-h), var(--brand-s), var(--brand-l));
          --brand-dark:   hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 12%));
          --brand-glow:   hsl(var(--brand-h), 90%, calc(var(--brand-l) + 14%));
          --brand-faint:  hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
          --brand-border: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.28);
          background: linear-gradient(
            135deg,
            hsl(var(--brand-h), 55%, 7%) 0%,
            hsl(var(--brand-h), 35%, 4%) 60%,
            hsl(270, 25%, 5%) 100%
          );
          min-height: 100vh;
        }
        .public-form-page .brand-strip {
          background: var(--brand);
        }
        .public-form-page input,
        .public-form-page select,
        .public-form-page textarea {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: rgba(255,255,255,0.9) !important;
        }
        .public-form-page input::placeholder,
        .public-form-page textarea::placeholder {
          color: rgba(255,255,255,0.28) !important;
        }
        .public-form-page select option {
          background: hsl(220, 25%, 12%);
          color: rgba(255,255,255,0.9);
        }
        .public-form-page input:focus,
        .public-form-page select:focus,
        .public-form-page textarea:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--brand-faint), 0 0 0 1px var(--brand-border) !important;
          border-color: var(--brand) !important;
        }
        .public-form-page .video-glow {
          box-shadow: 0 0 32px var(--brand-faint);
        }
      `}</style>

      {/* Brand color strip */}
      <div className="brand-strip fixed top-0 left-0 right-0 h-1 z-50" />

      {/* Card */}
      <div
        className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Hero media */}
        {form.media_type === "video" && form.video_embed_url && (
          <div className="video-glow w-full" style={{ aspectRatio: "16/9" }}>
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
            className="w-full object-cover"
            style={{ maxHeight: "240px" }}
          />
        )}
        {form.media_type !== "video" && form.hero_image_url && (
          <img
            src={form.hero_image_url}
            alt={form.hero_image_alt ?? ""}
            className="w-full object-cover"
            style={{ maxHeight: "240px" }}
          />
        )}

        {/* Card body */}
        <div className="p-8 space-y-5">
          {/* Eyebrow / badge */}
          {form.badge_text && (
            <p
              style={{
                color: "var(--brand)",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              // {form.badge_text}
            </p>
          )}

          {/* Title + subtitle */}
          {(form.title || form.name) && (
            <div>
              <h1
                style={{
                  color: "rgba(255,255,255,0.95)",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  lineHeight: 1.25,
                  margin: 0,
                }}
              >
                {form.title || form.name}
              </h1>
              {form.subtitle && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.48)",
                    fontSize: "0.875rem",
                    marginTop: "0.375rem",
                  }}
                >
                  {form.subtitle}
                </p>
              )}
            </div>
          )}

          {/* Form fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {fieldGroups.map((group) => {
              if (Array.isArray(group)) {
                const [f1, f2] = group;
                return (
                  <div key={`pair-${f1.id}`} className="grid grid-cols-2 gap-3">
                    {renderFieldCell(f1)}
                    {renderFieldCell(f2)}
                  </div>
                );
              }
              return <div key={group.id}>{renderFieldCell(group)}</div>;
            })}

            {inlineError && (
              <p style={{ color: "#f87171", fontSize: "0.875rem" }}>{inlineError}</p>
            )}

            <Button
              type="submit"
              className="w-full gap-2 font-semibold transition-opacity hover:opacity-90 active:scale-95"
              disabled={submitting}
              style={{
                backgroundColor: "var(--brand)",
                borderColor: "var(--brand-dark)",
                height: "3rem",
                fontSize: "1rem",
                color: "#fff",
                marginTop: "0.25rem",
              }}
            >
              {submitting ? (
                "Enviando..."
              ) : (
                <>
                  <span>{form.cta_text || "Enviar"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            {form.trust_text && (
              <p
                style={{
                  color: "rgba(255,255,255,0.32)",
                  fontSize: "0.72rem",
                  textAlign: "center",
                }}
              >
                🔒 {form.trust_text}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
