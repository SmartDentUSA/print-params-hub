import { assertEquals } from "jsr:@std/assert@1";
import { normalizePhoneForCountry, countryCode } from "./phone-country.ts";

Deno.test("país do evento completa o código de número estrangeiro sem +", () => {
  assertEquals(countryCode("United States"), "1");
  assertEquals(normalizePhoneForCountry("704 308 9396", "", "United States"), "17043089396");
  assertEquals(normalizePhoneForCountry("212 345 6789", "", "Estados Unidos"), "12123456789");
});

Deno.test("celular brasileiro em evento nos EUA continua +55", () => {
  assertEquals(normalizePhoneForCountry("16 99750-1531", "", "United States"), "5516997501531");
});

Deno.test("código explícito vale e números colados são recusados", () => {
  assertEquals(normalizePhoneForCountry("+351 912 345 678", "", "United States"), "351912345678");
  assertEquals(normalizePhoneForCountry("78631227097866164236", "Estados Unidos"), "");
});
