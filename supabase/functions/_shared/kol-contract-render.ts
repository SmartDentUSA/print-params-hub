// _shared/kol-contract-render.ts — mini-renderizador do modelo de contrato KOL.
// Suporta: {{path}}, {{#if path}}, {{#if path == "valor"}}, {{else}}, {{/if}},
// {{#each path}} ... {{/each}} (com {{campo}} do item e {{@index}}).
// O texto jurídico vive em kol_contract_templates.body_md — NUNCA hardcodar cláusulas aqui.

export type Ctx = Record<string, any>;

function lookup(ctx: Ctx, path: string): any {
  if (path === "@index") return ctx["@index"];
  const parts = path.split(".");
  let cur: any = ctx;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

function truthy(v: any): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function renderSection(tpl: string, ctx: Ctx): string {
  let out = "";
  let i = 0;
  while (i < tpl.length) {
    const open = tpl.indexOf("{{", i);
    if (open === -1) { out += tpl.slice(i); break; }
    out += tpl.slice(i, open);
    const close = tpl.indexOf("}}", open);
    if (close === -1) { out += tpl.slice(open); break; }
    const tag = tpl.slice(open + 2, close).trim();

    if (tag.startsWith("#if ") || tag.startsWith("#each ")) {
      const isIf = tag.startsWith("#if ");
      const expr = tag.slice(isIf ? 4 : 6).trim();
      const endTag = isIf ? "{{/if}}" : "{{/each}}";
      // encontra o fechamento correspondente (sem aninhamento do mesmo tipo)
      const elseIdx = tpl.indexOf("{{else}}", close);
      const endIdx = tpl.indexOf(endTag, close);
      if (endIdx === -1) { out += tpl.slice(open); break; }
      const hasElse = elseIdx !== -1 && elseIdx < endIdx;
      const body = tpl.slice(close + 2, hasElse ? elseIdx : endIdx);
      const elseBody = hasElse ? tpl.slice(elseIdx + 8, endIdx) : "";

      if (isIf) {
        const m = expr.match(/^(.+?)\s*==\s*"([^"]*)"$/);
        let cond: boolean;
        if (m) cond = String(lookup(ctx, m[1].trim()) ?? "") === m[2];
        else cond = truthy(lookup(ctx, expr));
        out += renderSection(cond ? body : elseBody, ctx);
      } else {
        const arr = lookup(ctx, expr);
        if (Array.isArray(arr)) {
          arr.forEach((item, idx) => {
            const child: Ctx = typeof item === "object" && item !== null
              ? { ...ctx, ...item, "@index": idx }
              : { ...ctx, this: item, "@index": idx };
            out += renderSection(body, child);
          });
        }
      }
      i = endIdx + endTag.length;
      continue;
    }

    if (tag.startsWith("/") || tag === "else") { i = close + 2; continue; }
    const v = lookup(ctx, tag);
    out += v === null || v === undefined ? "" : String(v);
    i = close + 2;
  }
  return out;
}

export function renderKolContract(template: string, ctx: Ctx): string {
  return renderSection(template, ctx).replace(/\n{3,}/g, "\n\n").trim();
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Campos do contrato que dependem de decisão de negócio; vazios viram pendência e bloqueiam o envio. */
export const KOL_CONTRACT_PARAM_DEFAULTS: Record<string, any> = {
  janela_atribuicao_dias: 90,        // decidido: janela de atribuição de indicação
  periodo_inatividade_dias: 90,      // decidido: inatividade
  meses_sem_conteudo: 2,             // decidido: meses sem publicar conteúdo
  conteudo_minimo_mes: 2,
  conteudo_minimo_mes_extenso: "dois",
  conteudo_formatos: "posts, stories e vídeos curtos",
  conteudo_dias_no_ar: 30,
  comodato_aluguel_pena_pct_mes: 1,
  eventos_remuneracao_texto: "A participação do KOL em eventos como palestrante ou apoio de estande não é remunerada, salvo ajuste específico por escrito entre as partes para cada evento.",
  desconto_insumos_pct: 10,
  desconto_insumos_pct_extenso: "dez",
};

export const KOL_CONTRACT_BRAND_DEFAULTS: Record<string, any> = {
  perfil_instagram: "@smartdent.3d",
};

export const KOL_CONTRACT_IMAGE_DEFAULTS: Record<string, any> = {
  prazo_retirada_dias: 30,
  registros_anteriores: "",
};
