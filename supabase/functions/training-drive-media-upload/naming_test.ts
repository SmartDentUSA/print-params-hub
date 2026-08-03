import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGeneratedFilename, DESTINATIONS, kindOfMime } from "./naming.ts";

Deno.test("video vertical com dia", () => {
  const { filename } = buildGeneratedFilename({
    turmaNumber: 154, courseTitle: "Chairside Print", destination: DESTINATIONS["videos_vertical"],
    trainingDate: "2026-07-22", trainingDay: 1, mimeType: "video/mp4",
  } as any, []);
  assertEquals(filename, "T154_CHAIRSIDE_PRINT_2026-07-22_DIA-1_VIDEO_VERTICAL_001.mp4");
});

Deno.test("atividade pratica dia 2 mov", () => {
  const { filename } = buildGeneratedFilename({
    turmaNumber: 154, courseTitle: "Chairside Print", destination: DESTINATIONS["videos_atividades"],
    trainingDate: "2026-07-23", trainingDay: 2, mimeType: "video/quicktime",
  } as any, []);
  assertEquals(filename, "T154_CHAIRSIDE_PRINT_2026-07-23_DIA-2_ATIVIDADE_PRATICA_001.mov");
});

Deno.test("foto da turma geral", () => {
  const { filename } = buildGeneratedFilename({
    turmaNumber: 154, courseTitle: "Chairside Print", destination: DESTINATIONS["fotos_turma"], mimeType: "image/jpeg",
  } as any, []);
  assertEquals(filename, "T154_CHAIRSIDE_PRINT_GERAL_FOTO_TURMA_001.jpg");
});

Deno.test("depoimento com sequencia incremental e acentos", () => {
  const parts = {
    turmaNumber: 154, courseTitle: "Chairside Print", destination: DESTINATIONS["videos_depoimentos"],
    participantName: "María Silvá", mimeType: "video/mp4",
  } as any;
  assertEquals(buildGeneratedFilename(parts, []).filename, "T154_CHAIRSIDE_PRINT_DEPOIMENTO_MARIA-SILVA_001.mp4");
  assertEquals(
    buildGeneratedFilename(parts, ["T154_CHAIRSIDE_PRINT_DEPOIMENTO_MARIA-SILVA_001.mp4"]).filename,
    "T154_CHAIRSIDE_PRINT_DEPOIMENTO_MARIA-SILVA_002.mp4",
  );
});

Deno.test("mime nao permitido", () => {
  assertEquals(kindOfMime("application/pdf"), null);
  assertEquals(kindOfMime("video/mp4"), "video");
  assertEquals(DESTINATIONS["destino_falso"], undefined);
});
