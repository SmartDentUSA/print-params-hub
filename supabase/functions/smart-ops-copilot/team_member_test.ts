import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeTeamPhone, validateTeamMember, EVOLUTION_DEFAULT_URL } from "./team-member.ts";

const base = { nome_completo: "Maria Souza", email: "Maria@SmartDent.com.br", whatsapp_number: "(16) 99750-1531", role: "operacao" };

Deno.test("membro: nome, e-mail e WhatsApp obrigatórios como na tela", () => {
  const r = validateTeamMember({ role: "vendedor" });
  assert(r.errors.includes("Nome completo é obrigatório."));
  assert(r.errors.includes("E-mail inválido."));
  assert(r.errors.some((e) => e.startsWith("WhatsApp inválido")));
});

Deno.test("membro: WhatsApp vira +55 com DDD, com ou sem 55", () => {
  assertEquals(normalizeTeamPhone("(16) 99750-1531"), "+5516997501531");
  assertEquals(normalizeTeamPhone("5516997501531"), "+5516997501531");
  assertEquals(normalizeTeamPhone("1634194735"), "+551634194735");
  assertEquals(normalizeTeamPhone("997501531"), null);
});

Deno.test("membro: função só entre as da tela e e-mail em minúsculas", () => {
  assert(validateTeamMember({ ...base, role: "admin" }).errors.includes("Função inválida."));
  const ok = validateTeamMember(base);
  assertEquals(ok.errors, []);
  assertEquals(ok.row?.email, "maria@smartdent.com.br");
  assertEquals(ok.row?.role, "operacao");
  assertEquals(ok.row?.evolution_base_url, EVOLUTION_DEFAULT_URL);
  assertEquals(ok.row?.messaging_provider, "evolution");
});

Deno.test("membro: só administradores cadastram pelo passo a passo", async () => {
  const { wizardAllowed, submitWizard } = await import("./guided.ts");
  const ctx = { sb: null, userId: "u", supabaseUrl: "", serviceKey: "", isAdmin: false } as any;
  assertEquals(wizardAllowed(ctx, "membro_equipe").allowed, false);
  assertEquals(wizardAllowed({ ...ctx, isAdmin: true }, "membro_equipe").allowed, true);
  assertEquals((await submitWizard(ctx, "membro_equipe", base)).ok, false);
});
