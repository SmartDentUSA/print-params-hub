// Roteiros de Social Publisher › Post Grupos no Copilot, na ordem da tela:
// • Instâncias: instância → ativa? → buscar e marcar grupos → redes sociais → Salvar.
// • Automação de Lives: nome → instâncias → grupos → lives → propaganda (dias,
//   horário, texto) → lembrete ao vivo (minutos, texto) → ativa? → Salvar.
import type { WizardQuestion, WizardScript, WizardAnswer } from "./copilotWizard.ts";
import { WIZ_CONFIRM, WIZ_CANCEL, WIZ_SKIP } from "./copilotWizard.ts";
import { matchOption, type WizardOption } from "./copilotWizardParse.ts";
import { ALL_PLATFORM_VALUES, SOCIAL_PLATFORMS, platformLabel } from "../components/social/socialPlatforms.ts";
import { LIVE_NOW_TEMPLATE, LIVE_PROMO_TEMPLATE, LIVE_TEMPLATE_VARS } from "./social/liveTemplates.ts";
import { fmtTime } from "./social/bulkPlan.ts";
import { parseTimeBR } from "./copilotSocialPostWizard.ts";

export type GroupInstance = { name: string; enabled: boolean; targets: number; available: number };
export type GroupRef = { id: string; name: string; members: number; instance: string };
export type LiveCourse = { id: string; title: string; category: string };
export type SocialGroupsDeps = {
  loadInstances(): Promise<GroupInstance[]>;
  targetIds(instance: string): Promise<string[]>;
  searchInstanceGroups(instance: string, q: string): Promise<GroupRef[]>;
  loadTargetGroups(): Promise<GroupRef[]>;
  loadLiveCourses(): Promise<LiveCourse[]>;
};

const PG = "Post Grupos";
const ALL = "__all";
const AGAIN = "__again";
export const GROUP_PAGE = 40;
const SKIP: WizardOption = { value: WIZ_SKIP, label: "Pular" };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const parseIds = (raw: string): string[] | null => {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : null; } catch { return null; }
};
const groupLabel = (g: GroupRef) => `${g.name}${g.members ? ` (${g.members})` : ""}`;
const review = (what: string): WizardOption[] => [{ value: WIZ_CONFIRM, label: `Confirmar e ${what}` }, { value: WIZ_CANCEL, label: "Cancelar" }];

/** Busca local por parte do nome (sem acento), maiores grupos primeiro. */
export function filterGroups(groups: GroupRef[], q: string, exclude: Set<string>, limit = GROUP_PAGE) {
  const t = norm(q);
  return groups
    .filter((g) => !exclude.has(g.id) && (!t || t === ALL || norm(g.name).includes(t)))
    .sort((a, b) => b.members - a.members)
    .slice(0, limit);
}

/* ─────────────────────── Post Grupos › Instâncias ─────────────────────── */

export type TargetsStep = "instancia" | "ativar" | "busca" | "grupos" | "mais" | "redes" | "review";
export type TargetsState = {
  step: TargetsStep; instances: GroupInstance[]; instance: GroupInstance | null; existing: string[];
  enabled: boolean; results: GroupRef[]; picked: GroupRef[]; platforms: string[];
};

function targetsQuestion(s: TargetsState): WizardQuestion {
  const inst = s.instance;
  switch (s.step) {
    case "instancia":
      return {
        where: `${PG} › Instâncias`, input: "choice", ask: "Em qual **instância** de WhatsApp?",
        help: "Cada instância envia os posts novos do Banco de Posts para os grupos dela.",
        options: s.instances.map((i) => ({ value: i.name, label: `${i.name} · ${i.enabled ? "ATIVA" : "inativa"}`, hint: `${i.targets} grupo(s) recebendo · ${i.available} disponíveis` })),
      };
    case "ativar":
      return {
        where: `${PG} › ${inst?.name} › Ativa`, input: "choice", ask: inst?.enabled ? "A instância está **ATIVA**. Mantém?" : "A instância está **inativa**. Quer ativar?",
        help: "Só instâncias ativas disparam os posts novos para os grupos.",
        options: inst?.enabled ? [{ value: "on", label: "Manter ATIVA" }, { value: "off", label: "Desativar" }] : [{ value: "on", label: "Ativar a instância" }, { value: "off", label: "Deixar inativa" }],
      };
    case "busca":
      return {
        where: `${PG} › ${inst?.name} › Adicionar grupos`, input: "text", ask: "Qual **grupo** adicionar? Digite parte do nome.",
        help: `${s.existing.length} grupo(s) já recebem posts nesta instância.${s.picked.length ? ` ${s.picked.length} marcado(s) agora.` : ""}`,
        quick: [{ value: ALL, label: "Mostrar os maiores" }, { value: WIZ_SKIP, label: s.picked.length ? "Seguir" : "Não adicionar grupos" }],
      };
    case "grupos":
      return { where: `${PG} › ${inst?.name} › Adicionar grupos`, input: "multi", ask: "Marque os **grupos** que vão receber os posts.", options: s.results.map((g) => ({ value: g.id, label: groupLabel(g) })), selected: [], quick: [{ value: AGAIN, label: "Buscar outro nome" }] };
    case "mais":
      return { where: `${PG} › ${inst?.name} › Adicionar grupos`, input: "choice", ask: `${s.picked.length} grupo(s) marcado(s). Quer **buscar mais**?`, options: [{ value: "more", label: "Buscar mais grupos" }, { value: "next", label: "Seguir para as redes sociais" }] };
    case "redes":
      return { where: `${PG} › ${inst?.name} › Redes sociais`, input: "multi", ask: "Posts de quais **redes sociais** esses grupos recebem?", options: SOCIAL_PLATFORMS.map((p) => ({ value: p.value, label: p.label })), selected: s.platforms };
    case "review":
      return { where: `${PG} › Salvar`, input: "choice", ask: "Confira o resumo acima. **Posso salvar?**", help: "Ao confirmar os grupos passam a receber os próximos posts.", options: review("salvar") };
  }
}

async function targetsAnswer(s: TargetsState, raw: string, deps: SocialGroupsDeps): Promise<WizardAnswer<TargetsState>> {
  const r = String(raw ?? "").trim();
  const go = (step: TargetsStep, patch: Partial<TargetsState> = {}): WizardAnswer<TargetsState> => ({ state: { ...s, ...patch, step } });
  const err = (error: string): WizardAnswer<TargetsState> => ({ error });
  const finishGroups = (st: Partial<TargetsState> = {}) => {
    const next = { ...s, ...st };
    if (next.picked.length) return go("redes", st);
    if (next.enabled === s.instance?.enabled) return err("Nada para salvar: marque pelo menos um grupo ou mude a instância para ativa/inativa.");
    return go("review", st);
  };

  switch (s.step) {
    case "instancia": {
      const opt = matchOption(r, s.instances.map((i) => ({ value: i.name, label: i.name })));
      const inst = opt && s.instances.find((i) => i.name === opt.value);
      if (!inst) return err("Escolha uma das instâncias da lista.");
      const existing = await deps.targetIds(inst.name);
      return go("ativar", { instance: inst, existing, enabled: inst.enabled, picked: [], results: [] });
    }
    case "ativar": {
      const on = r === "on" || /^(manter|ativar|sim)/.test(norm(r)) ? true : r === "off" || /^(desativar|deixar|nao)/.test(norm(r)) ? false : null;
      if (on === null) return err("Escolha uma das opções.");
      return go("busca", { enabled: on });
    }
    case "busca": {
      if (r === WIZ_SKIP) return finishGroups();
      if (r !== ALL && r.length < 2) return err("Digite pelo menos 2 letras do nome do grupo.");
      const found = await deps.searchInstanceGroups(s.instance!.name, r === ALL ? "" : r);
      const exclude = new Set([...s.existing, ...s.picked.map((g) => g.id)]);
      const results = filterGroups(found, r, exclude);
      if (!results.length) return err(r === ALL ? "Todos os grupos desta instância já recebem posts." : `Nenhum grupo novo com “${r}” nesta instância. Tente outra parte do nome.`);
      return go("grupos", { results });
    }
    case "grupos": {
      if (r === AGAIN) return go("busca", { results: [] });
      const ids = parseIds(r);
      if (!ids) return err("Marque os grupos e clique em Concluir.");
      const add = s.results.filter((g) => ids.includes(g.id));
      return go("mais", { picked: [...s.picked, ...add], results: [] });
    }
    case "mais": {
      const opt = matchOption(r, [{ value: "more", label: "Buscar mais grupos" }, { value: "next", label: "Seguir para as redes sociais" }]);
      if (!opt) return err("Escolha uma das opções.");
      return opt.value === "more" ? go("busca") : finishGroups();
    }
    case "redes": {
      const ids = parseIds(r);
      if (!ids || !ids.length) return err("Marque pelo menos uma rede social.");
      const valid = ids.filter((p) => ALL_PLATFORM_VALUES.includes(p));
      return go("review", { platforms: valid });
    }
    case "review": return { state: s };
  }
}

export const postGroupsWizard: WizardScript<TargetsState, SocialGroupsDeps> = {
  key: "post_grupos",
  title: "Grupos que recebem os posts",
  intro: "Vamos configurar **Social Publisher › Post Grupos**: a instância e os grupos de WhatsApp que recebem automaticamente os posts novos do Banco de Posts.",
  async init(deps) {
    const instances = (await deps.loadInstances()).sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.available - a.available);
    return { step: "instancia", instances, instance: null, existing: [], enabled: false, results: [], picked: [], platforms: [...ALL_PLATFORM_VALUES] };
  },
  question: targetsQuestion,
  answer: targetsAnswer,
  isReview: (s) => s.step === "review",
  summary(s) {
    const names = s.picked.map(groupLabel);
    return [
      "**Resumo — Post Grupos**",
      `- **Instância:** ${s.instance?.name} — ${s.enabled ? "ATIVA" : "inativa"}${s.enabled !== s.instance?.enabled ? " (vai mudar)" : ""}`,
      `- **Grupos novos:** ${names.length ? `${names.length} — ${names.slice(0, 15).join(", ")}${names.length > 15 ? "…" : ""}` : "nenhum"}`,
      ...(names.length ? [`- **Redes sociais:** ${s.platforms.length === ALL_PLATFORM_VALUES.length ? "todas" : s.platforms.map(platformLabel).join(", ")}`] : []),
    ].join("\n");
  },
  payload: (s) => ({ instance_name: s.instance?.name, enabled: s.enabled, group_ids: s.picked.map((g) => g.id), platforms: s.platforms }),
};

/* ───────────────────── Post Grupos › Automação de Lives ───────────────────── */

export type LivesStep =
  | "nome" | "instancias" | "busca" | "grupos" | "mais" | "lives"
  | "promo_on" | "promo_dias" | "promo_hora" | "promo_texto"
  | "live_on" | "live_min" | "live_texto" | "ativar" | "review";
export type LivesData = {
  name: string; enabled: boolean; instance_names: string[]; course_ids: string[];
  promo_enabled: boolean; promo_days_before: number; promo_time: string; promo_template: string;
  live_enabled: boolean; live_minutes_before: number; live_template: string;
};
export type LivesState = { step: LivesStep; groups: GroupRef[]; courses: LiveCourse[]; results: GroupRef[]; picked: GroupRef[]; data: LivesData };

const LV = `${PG} › Automação de Lives`;
const instancesOf = (groups: GroupRef[]) => {
  const m = new Map<string, number>();
  groups.forEach((g) => m.set(g.instance, (m.get(g.instance) ?? 0) + 1));
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
};
const poolOf = (s: LivesState) => s.data.instance_names.length ? s.groups.filter((g) => s.data.instance_names.includes(g.instance)) : s.groups;

function livesQuestion(s: LivesState): WizardQuestion {
  const d = s.data;
  switch (s.step) {
    case "nome":
      return { where: `${LV} › Nome`, input: "text", ask: "Qual o **nome** da automação?", quick: [{ value: "__default", label: "Divulgação de Lives" }] };
    case "instancias":
      return { where: `${LV} › Instâncias de envio`, input: "multi", ask: "Por quais **instâncias** enviar?", help: "Sem marcar nenhuma, cada grupo usa a instância dele.", options: instancesOf(s.groups).map(([n, c]) => ({ value: n, label: `${n} (${c} grupos)` })), selected: d.instance_names, quick: [{ value: ALL, label: "Todas as instâncias" }] };
    case "busca":
      return { where: `${LV} › Grupos de WhatsApp`, input: "text", ask: "Qual **grupo** recebe os avisos? Digite parte do nome.", help: `Só grupos já configurados em Post Grupos.${s.picked.length ? ` ${s.picked.length} marcado(s).` : ""}`, quick: [{ value: ALL, label: "Mostrar os maiores" }, ...(s.picked.length ? [{ value: WIZ_SKIP, label: "Seguir" }] : [])] };
    case "grupos":
      return { where: `${LV} › Grupos de WhatsApp`, input: "multi", ask: "Marque os **grupos**.", options: s.results.map((g) => ({ value: g.id, label: groupLabel(g), hint: g.instance })), selected: [], quick: [{ value: AGAIN, label: "Buscar outro nome" }] };
    case "mais":
      return { where: `${LV} › Grupos de WhatsApp`, input: "choice", ask: `${s.picked.length} grupo(s) marcado(s). Quer **buscar mais**?`, options: [{ value: "more", label: "Buscar mais grupos" }, { value: "next", label: "Seguir para as lives" }] };
    case "lives":
      return { where: `${LV} › Lives incluídas`, input: "multi", ask: "Quais **lives** divulgar?", help: "Sem marcar nenhuma, todas as lives ativas entram.", options: s.courses.map((c) => ({ value: c.id, label: c.title, hint: c.category })), selected: d.course_ids, quick: [{ value: ALL, label: "Todas as lives" }] };
    case "promo_on":
      return { where: `${LV} › Propaganda`, input: "choice", ask: "Enviar **propaganda** antes da live?", options: [{ value: "on", label: "Sim, enviar propaganda" }, { value: "off", label: "Não" }] };
    case "promo_dias":
      return { where: `${LV} › Propaganda › Dias antes`, input: "number", ask: "Quantos **dias antes** da live?", help: "0 = no próprio dia.", quick: [{ value: "1", label: "1 dia antes" }, { value: "0", label: "No dia" }] };
    case "promo_hora":
      return { where: `${LV} › Propaganda › Horário`, input: "text", ask: "Em qual **horário** (Brasília)?", quick: [{ value: "08:30", label: "08:30" }, { value: "12:00", label: "12:00" }] };
    case "promo_texto":
      return { where: `${LV} › Propaganda › Texto`, input: "textarea", ask: "Qual o **texto da propaganda**?", help: `Texto padrão:\n${LIVE_PROMO_TEMPLATE}\n\nVariáveis: ${LIVE_TEMPLATE_VARS}`, quick: [{ value: "__default", label: "Usar o texto padrão" }] };
    case "live_on":
      return { where: `${LV} › Ao vivo`, input: "choice", ask: "Enviar **lembrete quando a live começar**?", options: [{ value: "on", label: "Sim, enviar lembrete" }, { value: "off", label: "Não" }] };
    case "live_min":
      return { where: `${LV} › Ao vivo › Minutos antes`, input: "number", ask: "Quantos **minutos antes** do início?", quick: [{ value: "5", label: "5 minutos" }, { value: "15", label: "15 minutos" }] };
    case "live_texto":
      return { where: `${LV} › Ao vivo › Texto`, input: "textarea", ask: "Qual o **texto do lembrete**?", help: `Texto padrão:\n${LIVE_NOW_TEMPLATE}\n\nVariáveis: ${LIVE_TEMPLATE_VARS}`, quick: [{ value: "__default", label: "Usar o texto padrão" }] };
    case "ativar":
      return { where: `${LV} › Ativa`, input: "choice", ask: "Deixo a automação **ativa** já?", options: [{ value: "on", label: "Ativa (começa a enviar)" }, { value: "off", label: "Pausada" }] };
    case "review":
      return { where: `${LV} › Salvar`, input: "choice", ask: "Confira o resumo acima. **Posso salvar a automação?**", options: review("salvar") };
  }
}

const onOff = (r: string) => (r === "on" || /^(sim|ativa)/.test(norm(r)) ? true : r === "off" || /^(nao|pausada)/.test(norm(r)) ? false : null);

async function livesAnswer(s: LivesState, raw: string): Promise<WizardAnswer<LivesState>> {
  const r = String(raw ?? "").trim();
  const d = s.data;
  const go = (step: LivesStep, patch: Partial<LivesData> = {}, extra: Partial<LivesState> = {}): WizardAnswer<LivesState> => ({ state: { ...s, ...extra, step, data: { ...d, ...patch } } });
  const err = (error: string): WizardAnswer<LivesState> => ({ error });

  switch (s.step) {
    case "nome": {
      const name = r === "__default" ? "Divulgação de Lives" : r;
      if (name.length < 3) return err("Dê um nome com pelo menos 3 letras.");
      return go("instancias", { name: name.slice(0, 120) });
    }
    case "instancias": {
      if (r === ALL) return go("busca", { instance_names: [] });
      const ids = parseIds(r);
      if (!ids) return err("Marque as instâncias e clique em Concluir.");
      return go("busca", { instance_names: ids });
    }
    case "busca": {
      if (r === WIZ_SKIP && s.picked.length) return go("lives");
      if (r !== ALL && r.length < 2) return err("Digite pelo menos 2 letras do nome do grupo.");
      const results = filterGroups(poolOf(s), r, new Set(s.picked.map((g) => g.id)));
      if (!results.length) return err(`Nenhum grupo com “${r === ALL ? "" : r}” nas instâncias escolhidas. Os grupos precisam estar em Post Grupos.`);
      return go("grupos", {}, { results });
    }
    case "grupos": {
      if (r === AGAIN) return go("busca", {}, { results: [] });
      const ids = parseIds(r);
      if (!ids) return err("Marque os grupos e clique em Concluir.");
      const add = s.results.filter((g) => ids.includes(g.id));
      return go("mais", {}, { picked: [...s.picked, ...add], results: [] });
    }
    case "mais": {
      const opt = matchOption(r, [{ value: "more", label: "Buscar mais grupos" }, { value: "next", label: "Seguir para as lives" }]);
      if (!opt) return err("Escolha uma das opções.");
      if (opt.value === "more") return go("busca");
      if (!s.picked.length) return err("Marque pelo menos um grupo.");
      return go("lives");
    }
    case "lives": {
      if (r === ALL) return go("promo_on", { course_ids: [] });
      const ids = parseIds(r);
      if (!ids) return err("Marque as lives e clique em Concluir.");
      return go("promo_on", { course_ids: ids.filter((id) => s.courses.some((c) => c.id === id)) });
    }
    case "promo_on": {
      const v = onOff(r);
      if (v === null) return err("Escolha Sim ou Não.");
      return go(v ? "promo_dias" : "live_on", { promo_enabled: v });
    }
    case "promo_dias": {
      const n = Number(r.replace(/\D/g, ""));
      if (!r.match(/\d/) || !Number.isInteger(n) || n < 0 || n > 30) return err("Digite um número de 0 a 30.");
      return go("promo_hora", { promo_days_before: n });
    }
    case "promo_hora": {
      const t = parseTimeBR(r);
      if (t === null) return err("Não entendi o horário. Ex.: 08:30.");
      return go("promo_texto", { promo_time: fmtTime(t) });
    }
    case "promo_texto": {
      const v = r === "__default" ? LIVE_PROMO_TEMPLATE : r;
      if (v.length < 10) return err("O texto ficou curto demais.");
      return go("live_on", { promo_template: v.slice(0, 4000) });
    }
    case "live_on": {
      const v = onOff(r);
      if (v === null) return err("Escolha Sim ou Não.");
      if (!v && !d.promo_enabled) return err("Ative pelo menos a propaganda ou o lembrete ao vivo — senão a automação não envia nada.");
      return go(v ? "live_min" : "ativar", { live_enabled: v });
    }
    case "live_min": {
      const n = Number(r.replace(/\D/g, ""));
      if (!Number.isInteger(n) || n < 1 || n > 240) return err("Digite um número de 1 a 240.");
      return go("live_texto", { live_minutes_before: n });
    }
    case "live_texto": {
      const v = r === "__default" ? LIVE_NOW_TEMPLATE : r;
      if (v.length < 10) return err("O texto ficou curto demais.");
      return go("ativar", { live_template: v.slice(0, 4000) });
    }
    case "ativar": {
      const v = onOff(r);
      if (v === null) return err("Escolha Ativa ou Pausada.");
      return go("review", { enabled: v });
    }
    case "review": return { state: s };
  }
}

export const liveAutomationWizard: WizardScript<LivesState, SocialGroupsDeps> = {
  key: "automacao_lives",
  title: "Automação de lives",
  intro: "Vamos criar uma **Automação de Lives** (Social Publisher › Post Grupos): propaganda antes da live e lembrete quando ela começar, nos grupos que você escolher.",
  async init(deps) {
    const [groups, courses] = await Promise.all([deps.loadTargetGroups(), deps.loadLiveCourses()]);
    return {
      step: "nome", groups, courses, results: [], picked: [],
      data: { name: "", enabled: false, instance_names: [], course_ids: [], promo_enabled: true, promo_days_before: 1, promo_time: "08:30", promo_template: LIVE_PROMO_TEMPLATE, live_enabled: true, live_minutes_before: 5, live_template: LIVE_NOW_TEMPLATE },
    };
  },
  question: livesQuestion,
  answer: (s, raw) => livesAnswer(s, raw),
  isReview: (s) => s.step === "review",
  summary(s) {
    const d = s.data;
    const lives = d.course_ids.length ? s.courses.filter((c) => d.course_ids.includes(c.id)).map((c) => c.title).join(", ") : "todas as lives ativas";
    return [
      `**Resumo — ${d.name}**`,
      `- **Instâncias:** ${d.instance_names.length ? d.instance_names.join(", ") : "a de cada grupo"}`,
      `- **Grupos:** ${s.picked.length} — ${s.picked.slice(0, 12).map(groupLabel).join(", ")}${s.picked.length > 12 ? "…" : ""}`,
      `- **Lives:** ${lives}`,
      `- **Propaganda:** ${d.promo_enabled ? `${d.promo_days_before === 0 ? "no dia" : `${d.promo_days_before} dia(s) antes`} às ${d.promo_time}` : "não"}`,
      `- **Lembrete ao vivo:** ${d.live_enabled ? `${d.live_minutes_before} min antes` : "não"}`,
      `- **Situação:** ${d.enabled ? "ativa" : "pausada"}`,
    ].join("\n");
  },
  payload: (s) => ({ ...s.data, group_ids: s.picked.map((g) => g.id) }),
};
