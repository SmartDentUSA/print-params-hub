// ═══════════════════════════════════════════════════════════
// 🧠 INTERNAL ENTITY INDEX — Wikidata-linked dental terms
// ═══════════════════════════════════════════════════════════

export interface EntityEntry {
  name: string;
  wikidata?: string;
  url?: string;
  description: string;
  aliases?: string[];
}

export const INTERNAL_ENTITY_INDEX: Record<string, EntityEntry> = {
  // ── Odontologia & Especialidades ──
  ODONTOLOGIA: {
    name: "Odontologia",
    wikidata: "https://www.wikidata.org/wiki/Q12128",
    description: "Ciência da saúde dedicada ao diagnóstico, prevenção e tratamento de doenças bucais.",
    aliases: ["dentistry", "odontología"]
  },
  ODONTOLOGIA_DIGITAL: {
    name: "Odontologia Digital",
    wikidata: "https://www.wikidata.org/wiki/Q1023932",
    description: "Integração de tecnologias digitais no fluxo de trabalho odontológico.",
    aliases: ["digital dentistry", "odontología digital"]
  },
  IMPLANTE_DENTARIO: {
    name: "Implante Dentário",
    wikidata: "https://www.wikidata.org/wiki/Q223809",
    description: "Dispositivo protético implantado cirurgicamente no osso maxilar ou mandibular.",
    aliases: ["dental implant", "implante dental"]
  },
  PROTESE_DENTARIA: {
    name: "Prótese Dentária",
    wikidata: "https://www.wikidata.org/wiki/Q1397513",
    description: "Dispositivo artificial para substituição de dentes ausentes.",
    aliases: ["dental prosthesis", "prótesis dental", "prosthodontics"]
  },
  ORTODONTIA: {
    name: "Ortodontia",
    wikidata: "https://www.wikidata.org/wiki/Q181260",
    description: "Especialidade odontológica para correção de posicionamento dentário.",
    aliases: ["orthodontics", "ortodoncia"]
  },

  // ── Materiais ──
  RESINA_COMPOSTA: {
    name: "Resina Composta",
    wikidata: "https://www.wikidata.org/wiki/Q1144215",
    description: "Material restaurador polimérico com partículas de carga inorgânica.",
    aliases: ["composite resin", "resina compuesta", "resina fotopolimerizável"]
  },
  ZIRCONIA: {
    name: "Zircônia",
    wikidata: "https://www.wikidata.org/wiki/Q81727",
    description: "Cerâmica de dióxido de zircônio utilizada em próteses dentárias de alta resistência.",
    aliases: ["zirconia", "dióxido de zircônio", "ZrO2"]
  },
  CERAMICA_ODONTOLOGICA: {
    name: "Cerâmica Odontológica",
    wikidata: "https://www.wikidata.org/wiki/Q45190",
    description: "Material cerâmico biocompatível para restaurações e próteses dentárias.",
    aliases: ["dental ceramic", "cerámica dental", "porcelana dental"]
  },
  PMMA: {
    name: "PMMA (Polimetilmetacrilato)",
    wikidata: "https://www.wikidata.org/wiki/Q146439",
    description: "Polímero termoplástico utilizado em próteses provisórias e definitivas.",
    aliases: ["polymethyl methacrylate", "acrílico dental"]
  },

  // ── Tecnologias de Fabricação ──
  IMPRESSAO_3D: {
    name: "Impressão 3D",
    wikidata: "https://www.wikidata.org/wiki/Q229367",
    description: "Fabricação aditiva por deposição camada a camada de material.",
    aliases: ["3D printing", "impresión 3D", "manufatura aditiva", "additive manufacturing"]
  },
  CAD_CAM: {
    name: "CAD/CAM",
    wikidata: "https://www.wikidata.org/wiki/Q207696",
    description: "Projeto assistido por computador e manufatura assistida por computador.",
    aliases: ["computer-aided design", "diseño asistido por computadora"]
  },
  SCANNER_INTRAORAL: {
    name: "Scanner Intraoral",
    wikidata: "https://www.wikidata.org/wiki/Q1023932",
    description: "Dispositivo de escaneamento digital para captura de impressões dentárias.",
    aliases: ["intraoral scanner", "escáner intraoral", "moldagem digital"]
  },
  FOTOPOLIMERIZACAO: {
    name: "Fotopolimerização",
    wikidata: "https://www.wikidata.org/wiki/Q899948",
    description: "Processo de polimerização iniciado por radiação luminosa (UV ou visível).",
    aliases: ["photopolymerization", "fotopolimerización", "cura UV", "light curing"]
  },
  DLP: {
    name: "DLP (Digital Light Processing)",
    wikidata: "https://www.wikidata.org/wiki/Q631962",
    description: "Tecnologia de impressão 3D por processamento digital de luz.",
    aliases: ["digital light processing"]
  },
  LCD_MSLA: {
    name: "LCD/mSLA",
    wikidata: "https://www.wikidata.org/wiki/Q229367",
    description: "Impressão 3D por fotopolimerização mascarada via painel LCD.",
    aliases: ["masked stereolithography", "LCD printing"]
  },
  SLA: {
    name: "SLA (Estereolitografia)",
    wikidata: "https://www.wikidata.org/wiki/Q746381",
    description: "Tecnologia de impressão 3D por estereolitografia a laser.",
    aliases: ["stereolithography", "estereolitografía"]
  },

  // ── Normas e Regulamentações ──
  ISO_4049: {
    name: "ISO 4049",
    url: "https://www.iso.org/standard/72530.html",
    description: "Padrão internacional para materiais restauradores poliméricos odontológicos.",
    aliases: ["ISO 4049:2019"]
  },
  ISO_10993: {
    name: "ISO 10993",
    url: "https://www.iso.org/standard/68936.html",
    description: "Série de normas para avaliação biológica de dispositivos médicos.",
    aliases: ["biocompatibility testing", "ISO 10993-1"]
  },
  ANVISA_RDC_185: {
    name: "RDC 185 ANVISA",
    url: "https://www.gov.br/anvisa/pt-br",
    description: "Resolução da ANVISA para registro de dispositivos médicos no Brasil.",
    aliases: ["RDC-185", "ANVISA"]
  },

  // ── Processos Clínicos ──
  FLUXO_CHAIRSIDE: {
    name: "Fluxo Digital Chairside",
    wikidata: "https://www.wikidata.org/wiki/Q1023932",
    description: "Integração direta entre escaneamento, design e fabricação no consultório.",
    aliases: ["chairside workflow", "same-day dentistry", "fluxo cadeira"]
  },
  GUIA_CIRURGICO: {
    name: "Guia Cirúrgico",
    wikidata: "https://www.wikidata.org/wiki/Q223809",
    description: "Dispositivo impresso em 3D para posicionamento preciso de implantes.",
    aliases: ["surgical guide", "guía quirúrgica"]
  },
  MODELO_DE_ESTUDO: {
    name: "Modelo de Estudo",
    wikidata: "https://www.wikidata.org/wiki/Q1397513",
    description: "Réplica tridimensional da arcada dentária para planejamento.",
    aliases: ["study model", "modelo diagnóstico"]
  },

  // ── Propriedade SmartDent ──
  ANP_TECHNOLOGY: {
    name: "Tecnologia ANP® (Advanced Nanosilicate Particles)",
    wikidata: "https://www.wikidata.org/wiki/Q1144215",
    description: "Sistema proprietário Smart Dent de estabilidade óptica e resistência mecânica."
  }
};

/**
 * Scans text and returns matched entities with their metadata.
 * Case-insensitive matching against entity names and aliases.
 */
export function matchEntities(text: string): Array<{ id: string; entity: EntityEntry; matchedTerm: string }> {
  const lowerText = text.toLowerCase();
  const matched: Array<{ id: string; entity: EntityEntry; matchedTerm: string }> = [];
  const seen = new Set<string>();

  for (const [id, entity] of Object.entries(INTERNAL_ENTITY_INDEX)) {
    if (seen.has(id)) continue;

    const termsToCheck = [entity.name, ...(entity.aliases || [])];
    for (const term of termsToCheck) {
      if (lowerText.includes(term.toLowerCase())) {
        matched.push({ id, entity, matchedTerm: term });
        seen.add(id);
        break;
      }
    }
  }

  return matched;
}

/**
 * Builds JSON-LD `about` and `mentions` arrays from matched entities.
 */
export function buildEntityGraph(matchedEntities: Array<{ id: string; entity: EntityEntry }>): {
  about: Array<Record<string, string>>;
  mentions: Array<Record<string, string>>;
} {
  const about: Array<Record<string, string>> = [];
  const mentions: Array<Record<string, string>> = [];

  for (const { entity } of matchedEntities) {
    const item: Record<string, string> = {
      "@type": "DefinedTerm",
      name: entity.name,
      description: entity.description
    };
    if (entity.wikidata) item.sameAs = entity.wikidata;
    if (entity.url) item.url = entity.url;

    // First 3 go to about, rest to mentions
    if (about.length < 3) {
      about.push(item);
    } else {
      mentions.push(item);
    }
  }

  return { about, mentions };
}
