import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findTeamMemberByPhone, teamPhoneMatches } from "./team-phone-match.ts";

const team = [
  { id: "wa", whatsapp_number: "+55 (16) 99750-1531", evolution_phone: null, notification_phone: null },
  { id: "ntf", whatsapp_number: "5511912340961", evolution_phone: null, notification_phone: "(11) 98888-9130" },
  { id: "evo", whatsapp_number: null, evolution_phone: "5521977774142", notification_phone: null },
  { id: "sem9", whatsapp_number: "551633334735", evolution_phone: null, notification_phone: null },
];

Deno.test("celular do WhatsApp cadastrado libera, com ou sem 55", () => {
  assertEquals(findTeamMemberByPhone(team, "5516997501531")?.id, "wa");
  assertEquals(findTeamMemberByPhone(team, "16997501531")?.id, "wa");
});

Deno.test("digitado sem o 9º dígito também libera", () => {
  assertEquals(findTeamMemberByPhone(team, "551697501531")?.id, "wa");
});

Deno.test("cadastrado sem 9 e digitado com 9 libera", () => {
  assertEquals(findTeamMemberByPhone(team, "16933334735")?.id, "sem9");
});

Deno.test("celular de notificação e da instância também liberam", () => {
  assertEquals(findTeamMemberByPhone(team, "11988889130")?.id, "ntf");
  assertEquals(findTeamMemberByPhone(team, "21977774142")?.id, "evo");
});

Deno.test("mesmo final com DDD diferente não libera", () => {
  assertEquals(findTeamMemberByPhone(team, "21997501531"), null);
  assertEquals(teamPhoneMatches("5516997501531", "5521997501531"), false);
});

Deno.test("celular fora da equipe ou curto demais não libera", () => {
  assertEquals(findTeamMemberByPhone(team, "16991112222"), null);
  assertEquals(findTeamMemberByPhone(team, "1531"), null);
});
