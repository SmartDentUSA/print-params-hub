import { test } from "node:test";
import assert from "node:assert/strict";
import { detectWizardIntent, WIZ_SKIP } from "./copilotWizard.ts";
import { teamMemberWizard, teamSeedFromText, type TeamDeps, type TeamState } from "./copilotTeamWizard.ts";

const deps: TeamDeps = {
  loadMembers: async () => [{ nome: "Daniel Ferreira", email: "daniel@smartdent.com.br", phones: ["+5516974065841"], ativo: true }],
};

async function run(answers: string[], seed = "") {
  let s: TeamState = await teamMemberWizard.init(deps, "2026-11-11", seed);
  const notes: string[] = [];
  for (const a of answers) {
    const r = await teamMemberWizard.answer(s, a, deps);
    if ("error" in r) throw new Error(`${s.step}: ${r.error}`);
    if (r.note) notes.push(r.note);
    s = r.state;
  }
  return { s, notes };
}

test("dentro de Equipe, o pedido escrito abre o cadastro de membro", () => {
  assert.equal(detectWizardIntent("quero cadastrar a Maria como vendedora", "so-equipe"), "membro_equipe");
  assert.equal(detectWizardIntent("criar novo membro na equipe"), "membro_equipe");
  assert.equal(detectWizardIntent("editar o membro João", "so-equipe"), null);
  assert.equal(detectWizardIntent("criar instância de grupos", "so-equipe"), null);
  assert.equal(detectWizardIntent("Quero criar uma campanha de Black Friday"), null);
});

test("pedido digitado já traz e-mail, celular e função", () => {
  assert.deepEqual(teamSeedFromText("cadastrar Maria, maria@smartdent.com.br, (16) 99750-1531, operação"),
    { email: "maria@smartdent.com.br", phone: "+5516997501531", role: "operacao" });
});

test("cadastro completo na ordem da tela, sem WhatsApp individual nem grupos", async () => {
  const { s } = await run(["Maria Souza", "Maria@SmartDent.com.br", "16 99750-1531", WIZ_SKIP, "operacao", WIZ_SKIP, "no", "none", "no"]);
  assert.equal(s.step, "review");
  const p = teamMemberWizard.payload(s);
  assert.equal(p.email, "maria@smartdent.com.br");
  assert.equal(p.whatsapp_number, "+5516997501531");
  assert.equal(p.role, "operacao");
  assert.equal(p.evolution_enabled, false);
  assert.equal(p.messaging_provider, "none");
});

test("e-mail repetido é recusado e celular repetido gera aviso", async () => {
  await assert.rejects(run(["Outro Nome", "daniel@smartdent.com.br"]), /Já existe um membro com esse e-mail: Daniel Ferreira/);
  const { notes } = await run(["Outro Nome", "outro@smartdent.com.br", "5516974065841"]);
  assert.match(notes[0], /Daniel Ferreira/);
});

test("WhatsApp individual ativado pede instância com sugestão pelo nome", async () => {
  const { s } = await run(["Maria Souza", "m@x.com", "16997501531", "123", "vendedor", WIZ_SKIP, "yes"]);
  assert.equal(s.step, "evo_instance");
  assert.equal(teamMemberWizard.question(s).quick?.[0].value, "maria_souza");
});
