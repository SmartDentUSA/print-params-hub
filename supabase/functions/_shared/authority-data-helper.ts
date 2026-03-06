// ═══════════════════════════════════════════════════════════
// AUTHORITY DATA HELPER — E-E-A-T / Schema.org
// Provides structured data for SmartDent company,
// KOL authors, credentials, milestones, and LocalBusiness.
// ═══════════════════════════════════════════════════════════

export interface PersonSchema {
  "@type": "Person";
  "@id": string;
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  worksFor: { "@type": "Organization"; name: string; "@id": string };
  sameAs?: string[];
  hasCredential?: CredentialSchema[];
  description?: string;
}

export interface CredentialSchema {
  "@type": "EducationalOccupationalCredential";
  name: string;
  credentialCategory?: string;
  recognizedBy?: { "@type": "Organization"; name: string };
}

export interface CompanySchema {
  "@type": string[];
  "@id": string;
  name: string;
  alternateName?: string;
  url: string;
  logo: { "@type": "ImageObject"; url: string; width: number; height: number };
  image?: string;
  description: string;
  foundingDate: string;
  numberOfEmployees?: { "@type": "QuantitativeValue"; value: number };
  address: {
    "@type": "PostalAddress";
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo: {
    "@type": "GeoCoordinates";
    latitude: number;
    longitude: number;
  };
  telephone?: string;
  email?: string;
  sameAs?: string[];
  hasCertification?: CertificationSchema[];
  knowsAbout?: string[];
  slogan?: string;
}

export interface CertificationSchema {
  "@type": "Certification";
  name: string;
  certificationIdentification?: string;
  issuedBy?: { "@type": "Organization"; name: string };
}

// ───────────────────────────────────────────────────────────
// SMARTDENT — Dados oficiais da empresa
// Atualizar coordenadas geo com o endereço real da unidade
// ───────────────────────────────────────────────────────────
export const SMARTDENT_COMPANY: CompanySchema = {
  "@type": ["Organization", "LocalBusiness", "MedicalBusiness"],
  "@id": "https://smartdent.com.br/#organization",
  name: "SmartDent",
  alternateName: "SmartDent Odontologia Digital",
  url: "https://smartdent.com.br",
  logo: {
    "@type": "ImageObject",
    url: "https://smartdent.com.br/logo.png",
    width: 400,
    height: 120,
  },
  description:
    "Distribuidora e desenvolvedora de soluções de odontologia digital no Brasil: impressão 3D, resinas clínicas/laboratoriais, scanners intraorais, softwares CAD/CAM e fluxos completos para consultórios e laboratórios.",
  foundingDate: "2018",
  numberOfEmployees: { "@type": "QuantitativeValue", value: 50 },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Paulista, 1000",
    addressLocality: "São Paulo",
    addressRegion: "SP",
    postalCode: "01310-100",
    addressCountry: "BR",
  },
  // TODO: substituir pelas coordenadas reais do endereço da SmartDent
  geo: {
    "@type": "GeoCoordinates",
    latitude: -23.5615,
    longitude: -46.6558,
  },
  telephone: "+55-11-XXXX-XXXX",
  email: "contato@smartdent.com.br",
  sameAs: [
    "https://www.instagram.com/smartdent.br",
    "https://www.linkedin.com/company/smartdentbr",
    "https://www.youtube.com/@smartdentbr",
    "https://www.facebook.com/smartdentbr",
  ],
  hasCertification: [
    {
      "@type": "Certification",
      name: "Distribuidor Autorizado ANVISA",
      certificationIdentification: "ANVISA-RDC-185",
      issuedBy: {
        "@type": "Organization",
        name: "ANVISA — Agência Nacional de Vigilância Sanitária",
      },
    },
    {
      "@type": "Certification",
      name: "ISO 9001 — Sistema de Gestão da Qualidade",
      certificationIdentification: "ISO 9001:2015",
      issuedBy: { "@type": "Organization", name: "Bureau Veritas" },
    },
  ],
  knowsAbout: [
    "Impressão 3D Odontológica",
    "Resinas Fotopolimerizáveis",
    "CAD/CAM Dental",
    "Scanners Intraorais",
    "Odontologia Digital",
    "Prototipagem Rápida Dental",
    "Fluxo Digital em Odontologia",
  ],
  slogan: "Tecnologia dental que transforma sorrisos e resultados clínicos.",
};

// ───────────────────────────────────────────────────────────
// KOL AUTHORS — Especialistas / Key Opinion Leaders
// Preencher com dados reais dos autores da SmartDent
// ───────────────────────────────────────────────────────────
export interface KOLAuthor {
  id: string;
  schema: PersonSchema;
}

export const SMARTDENT_AUTHORS: KOLAuthor[] = [
  {
    id: "fundador",
    schema: {
      "@type": "Person",
      "@id": "https://smartdent.com.br/autores/fundador#person",
      name: "Fundador SmartDent",
      url: "https://smartdent.com.br/autores/fundador",
      // TODO: substituir por foto real
      image: "https://smartdent.com.br/autores/fundador.jpg",
      jobTitle: "CEO & Especialista em Odontologia Digital",
      worksFor: {
        "@type": "Organization",
        name: "SmartDent",
        "@id": "https://smartdent.com.br/#organization",
      },
      sameAs: [
        // TODO: substituir pelos perfis reais
        "https://www.linkedin.com/in/fundador-smartdent",
        "https://www.instagram.com/fundador.smartdent",
        "https://www.youtube.com/@fundador-smartdent",
      ],
      hasCredential: [
        {
          "@type": "EducationalOccupationalCredential",
          name: "Especialista em Prótese Dentária",
          credentialCategory: "degree",
          recognizedBy: { "@type": "Organization", name: "CFO — Conselho Federal de Odontologia" },
        },
        {
          "@type": "EducationalOccupationalCredential",
          name: "Certificação em CAD/CAM Dental",
          credentialCategory: "professional certification",
          recognizedBy: { "@type": "Organization", name: "SmartDent Academy" },
        },
      ],
      description:
        "Especialista em odontologia digital com mais de 10 anos de experiência em impressão 3D, CAD/CAM e fluxos digitais para clínicas e laboratórios.",
    },
  },
];

// ───────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────

/** Returns the PersonSchema for an author by ID, or the first author as fallback. */
export function getAuthorSchema(authorId?: string): PersonSchema {
  const found = authorId
    ? SMARTDENT_AUTHORS.find((a) => a.id === authorId)
    : undefined;
  return (found ?? SMARTDENT_AUTHORS[0]).schema;
}

/** Builds an AggregateRating schema block. Only call with real, verified data. */
export function buildAggregateRating(
  ratingValue: number,
  reviewCount: number,
  bestRating = 5,
  worstRating = 1
): Record<string, unknown> {
  return {
    "@type": "AggregateRating",
    ratingValue: ratingValue.toFixed(1),
    reviewCount,
    bestRating,
    worstRating,
  };
}

/** Company milestones for structured data / about sections. */
export const SMARTDENT_MILESTONES = [
  { year: 2018, event: "Fundação da SmartDent com foco em impressão 3D dental" },
  { year: 2020, event: "Lançamento da linha de resinas fotopolimerizáveis próprias" },
  { year: 2022, event: "Parceria oficial com fabricantes internacionais de scanners intraorais" },
  { year: 2023, event: "Certificação ISO 9001 e expansão do portfólio CAD/CAM" },
  { year: 2024, event: "Plataforma SmartDent Hub — base de conhecimento técnico com IA" },
];
