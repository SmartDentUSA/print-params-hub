// ═══════════════════════════════════════════════════════════
// Authority Data Helper: E-E-A-T + Entity Knowledge Graph
// ═══════════════════════════════════════════════════════════

// ─── Credential & Professional Authority ───────────────────

export interface RecognizingAuthority {
  /** Name of the professional body or regulatory council */
  name: string;
  /** Public URL of the professional council (CFO, CRO, etc.) */
  url: string;
  /** ISO country code where the authority operates */
  country: 'BR' | 'PT' | string;
}

export interface ProfessionalCredential {
  /** Type of credential (e.g., "Registro CRO", "Especialização", "Doutoramento") */
  credentialType: string;
  /** Full name of the credential */
  name: string;
  /** Issuing institution */
  issuedBy: string;
  /** Registration or diploma number (if publicly disclosable) */
  registrationNumber?: string;
  /** Year the credential was obtained */
  yearObtained?: number;
  /**
   * Recognised by a professional/regulatory body.
   * Required for medical authority E-E-A-T scoring.
   */
  recognizedBy: RecognizingAuthority;
}

export interface PersonSchema {
  '@type': 'Person';
  name: string;
  jobTitle: string;
  description?: string;
  url?: string;
  image?: string;
  sameAs?: string[];
  /** REQUIRED for medical authority pages. Must include recognizedBy with council URL. */
  hasCredential: ProfessionalCredential[];
  worksFor?: {
    '@type': 'Organization';
    name: string;
    url?: string;
  };
  knowsAbout?: string[];
}

// ─── Entity Knowledge Graph (Wikidata) ─────────────────────

export interface WikidataEntity {
  /** Wikidata item ID (e.g., "Q1023932") */
  wikidataId: string;
  /** Canonical Wikidata URL */
  wikidataUrl: string;
  /** Human-readable label in Portuguese */
  labelPt: string;
  /** Brief description */
  description: string;
  /** Wikipedia or authoritative reference URL */
  referenceUrl?: string;
}

/**
 * ENTITY_KNOWLEDGE_GRAPH
 *
 * Maps domain terminology to Wikidata entities.
 * Used by the template engine to add sameAs links and entity linking
 * in JSON-LD structured data, satisfying AI-Readiness (GEO) requirements.
 *
 * Keys use lowercase for case-insensitive matching.
 */
export const ENTITY_KNOWLEDGE_GRAPH: Record<string, WikidataEntity> = {
  'odontologia digital': {
    wikidataId: 'Q1023932',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q1023932',
    labelPt: 'Odontologia Digital',
    description: 'Conjunto de tecnologias digitais aplicadas à odontologia, incluindo scanners intraorais, CAD/CAM e impressão 3D',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Odontologia_digital',
  },
  'impressao 3d': {
    wikidataId: 'Q229367',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q229367',
    labelPt: 'Impressão 3D',
    description: 'Fabricação por adição de objetos tridimensionais a partir de modelos digitais',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Impress%C3%A3o_3D',
  },
  'impressão 3d': {
    wikidataId: 'Q229367',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q229367',
    labelPt: 'Impressão 3D',
    description: 'Fabricação por adição de objetos tridimensionais a partir de modelos digitais',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Impress%C3%A3o_3D',
  },
  'cad/cam': {
    wikidataId: 'Q847863',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q847863',
    labelPt: 'CAD/CAM',
    description: 'Projeto assistido por computador e fabricação assistida por computador aplicados à odontologia',
    referenceUrl: 'https://pt.wikipedia.org/wiki/CAD/CAM',
  },
  'scanner intraoral': {
    wikidataId: 'Q29648806',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q29648806',
    labelPt: 'Scanner Intraoral',
    description: 'Dispositivo de captura digital tridimensional da cavidade oral',
    referenceUrl: 'https://en.wikipedia.org/wiki/Intraoral_scanner',
  },
  'resina composta': {
    wikidataId: 'Q901098',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q901098',
    labelPt: 'Resina Composta',
    description: 'Material restaurador polimérico utilizado em odontologia estética e funcional',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Resina_composta',
  },
  'protese dentaria': {
    wikidataId: 'Q1075688',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q1075688',
    labelPt: 'Prótese Dentária',
    description: 'Dispositivo artificial que substitui dentes ausentes ou restaura dentes danificados',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Pr%C3%B3tese_dent%C3%A1ria',
  },
  'prótese dentária': {
    wikidataId: 'Q1075688',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q1075688',
    labelPt: 'Prótese Dentária',
    description: 'Dispositivo artificial que substitui dentes ausentes ou restaura dentes danificados',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Pr%C3%B3tese_dent%C3%A1ria',
  },
  'implante dentario': {
    wikidataId: 'Q623109',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q623109',
    labelPt: 'Implante Dentário',
    description: 'Implante cirúrgico inserido no osso da mandíbula ou maxilar para suporte de prótese',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Implante_dent%C3%A1rio',
  },
  'implante dentário': {
    wikidataId: 'Q623109',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q623109',
    labelPt: 'Implante Dentário',
    description: 'Implante cirúrgico inserido no osso da mandíbula ou maxilar para suporte de prótese',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Implante_dent%C3%A1rio',
  },
  'odontologia': {
    wikidataId: 'Q35869',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q35869',
    labelPt: 'Odontologia',
    description: 'Ciência e prática do diagnóstico, tratamento e prevenção de doenças dos dentes, gengivas e boca',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Odontologia',
  },
  'zirconia': {
    wikidataId: 'Q421536',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q421536',
    labelPt: 'Zircônia',
    description: 'Óxido de zircônio utilizado em restaurações cerâmicas de alta resistência',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Zircônia',
  },
  'zircônia': {
    wikidataId: 'Q421536',
    wikidataUrl: 'https://www.wikidata.org/wiki/Q421536',
    labelPt: 'Zircônia',
    description: 'Óxido de zircônio utilizado em restaurações cerâmicas de alta resistência',
    referenceUrl: 'https://pt.wikipedia.org/wiki/Zircônia',
  },
};

// ─── Helpers ───────────────────────────────────────────────

/**
 * Looks up a term in the ENTITY_KNOWLEDGE_GRAPH (case-insensitive).
 * Returns undefined if no entity is found.
 */
export function lookupEntity(term: string): WikidataEntity | undefined {
  return ENTITY_KNOWLEDGE_GRAPH[term.toLowerCase()];
}

/**
 * Given an array of topic strings, returns all matching Wikidata entities.
 */
export function resolveEntities(topics: string[]): WikidataEntity[] {
  return topics
    .map((t) => lookupEntity(t))
    .filter((e): e is WikidataEntity => e !== undefined);
}

/**
 * Builds the sameAs array for a JSON-LD Product or Article using the entity graph.
 * Always includes the Wikidata URL of each matched entity.
 */
export function buildSameAsFromTopics(topics: string[]): string[] {
  return resolveEntities(topics)
    .map((e) => e.wikidataUrl)
    .filter(Boolean);
}

/**
 * Returns the reference URL for the most relevant entity matched from topics.
 * Used to populate the `about` field reference in JSON-LD.
 */
export function getPrimaryEntityReferenceUrl(topics: string[]): string | undefined {
  const entities = resolveEntities(topics);
  if (entities.length === 0) return undefined;
  return entities[0].referenceUrl ?? entities[0].wikidataUrl;
}

// ─── Council Constants ─────────────────────────────────────

/** Brazilian Federal Council of Dentistry */
export const CFO: RecognizingAuthority = {
  name: 'Conselho Federal de Odontologia (CFO)',
  url: 'https://website.cfo.org.br',
  country: 'BR',
};

/** Regional Councils of Dentistry (Brazil) — use with region suffix, e.g. CRO_SP */
export const CRO_SP: RecognizingAuthority = {
  name: 'Conselho Regional de Odontologia de São Paulo (CROSP)',
  url: 'https://www.crosp.org.br',
  country: 'BR',
};

export const CRO_RJ: RecognizingAuthority = {
  name: 'Conselho Regional de Odontologia do Rio de Janeiro (CRO-RJ)',
  url: 'https://www.cro-rj.org.br',
  country: 'BR',
};

/** Portuguese Dental Association */
export const OMD: RecognizingAuthority = {
  name: 'Ordem dos Médicos Dentistas (OMD)',
  url: 'https://www.omd.pt',
  country: 'PT',
};
