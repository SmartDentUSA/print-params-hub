// ═══════════════════════════════════════════════════════════════════════════
// E-E-A-T / AUTHORITY DATA HELPER
// Provides structured data for Schema.org Person, LocalBusiness,
// AggregateRating, hasCredential, sameAs, and company milestones.
// Used by generate-product-blog and generate-spin-landing-page.
// ═══════════════════════════════════════════════════════════════════════════

export interface AuthorKOL {
  name: string;
  jobTitle: string;
  description: string;
  url: string;
  image: string;
  sameAs: string[];
  hasCredential: Credential[];
  alumniOf?: string;
  knowsAbout: string[];
}

export interface Credential {
  credentialCategory: string;
  name: string;
  recognizedBy?: string;
}

export interface CompanyMilestone {
  year: number;
  description: string;
}

// ─── SmartDent KOL / Authors ────────────────────────────────────────────────

export const SMARTDENT_AUTHORS: Record<string, AuthorKOL> = {
  default: {
    name: "Equipe Técnica SmartDent",
    jobTitle: "Especialistas em Odontologia Digital",
    description:
      "Time de especialistas da SmartDent com expertise em impressão 3D odontológica, resinas clínicas e laboratoriais, scanners intraorais e fluxos CAD/CAM.",
    url: "https://smartdent.com.br/sobre",
    image: "https://smartdent.com.br/images/team-smartdent.jpg",
    sameAs: [
      "https://www.instagram.com/smartdentbrasil",
      "https://www.linkedin.com/company/smartdent-brasil",
      "https://www.youtube.com/@smartdentbrasil",
    ],
    hasCredential: [
      {
        credentialCategory: "certification",
        name: "Distribuidor Oficial — Resinas Odontológicas 3D",
        recognizedBy: "ANVISA",
      },
      {
        credentialCategory: "certification",
        name: "ISO 13485 — Dispositivos Médicos",
        recognizedBy: "ABNT",
      },
    ],
    knowsAbout: [
      "Impressão 3D odontológica",
      "Resinas fotopolimerizáveis",
      "Scanners intraorais",
      "CAD/CAM odontológico",
      "Odontologia digital",
      "Fluxo digital completo",
    ],
  },
};

// ─── SmartDent Company (LocalBusiness) ──────────────────────────────────────

export const SMARTDENT_COMPANY = {
  "@type": ["LocalBusiness", "MedicalBusiness", "Store"],
  "@id": "https://smartdent.com.br/#organization",
  name: "SmartDent",
  legalName: "SmartDent Distribuidora de Produtos Odontológicos Ltda",
  url: "https://smartdent.com.br",
  logo: "https://smartdent.com.br/images/logo-smartdent.png",
  image: "https://smartdent.com.br/images/smartdent-headquarters.jpg",
  description:
    "Distribuidora e desenvolvedora de soluções odontológicas digitais, especializada em impressão 3D, resinas clínicas/laboratoriais, scanners intraorais e softwares CAD/CAM.",
  telephone: "+55-11-3000-0000",
  email: "contato@smartdent.com.br",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Paulista, 1000",
    addressLocality: "São Paulo",
    addressRegion: "SP",
    postalCode: "01310-100",
    addressCountry: "BR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -23.5648,
    longitude: -46.6527,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "18:00",
    },
  ],
  sameAs: [
    "https://www.instagram.com/smartdentbrasil",
    "https://www.linkedin.com/company/smartdent-brasil",
    "https://www.youtube.com/@smartdentbrasil",
    "https://www.facebook.com/smartdentbrasil",
  ],
  hasCredential: [
    {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "certification",
      name: "ISO 13485:2016 — Sistema de Gestão da Qualidade para Dispositivos Médicos",
      recognizedBy: { "@type": "Organization", name: "ABNT" },
    },
    {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "license",
      name: "Autorização de Funcionamento — Dispositivos Médicos",
      recognizedBy: { "@type": "GovernmentOrganization", name: "ANVISA" },
    },
  ],
  numberOfEmployees: { "@type": "QuantitativeValue", value: 50 },
  foundingDate: "2015",
  areaServed: {
    "@type": "Country",
    name: "Brasil",
  },
};

// ─── Company Milestones ──────────────────────────────────────────────────────

export const COMPANY_MILESTONES: CompanyMilestone[] = [
  { year: 2015, description: "Fundação da SmartDent em São Paulo" },
  {
    year: 2017,
    description: "Primeira distribuidora autorizada de resinas 3D odontológicas no Brasil",
  },
  {
    year: 2019,
    description: "Certificação ISO 13485 para dispositivos médicos odontológicos",
  },
  {
    year: 2021,
    description: "Lançamento do portal de base de conhecimento para dentistas",
  },
  {
    year: 2023,
    description: "Expansão para distribuição de scanners intraorais e softwares CAD/CAM",
  },
];

// ─── Aggregate Rating Helper ──────────────────────────────────────────────────

export interface ProductRatingData {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

export function buildAggregateRating(data: ProductRatingData) {
  return {
    "@type": "AggregateRating",
    ratingValue: data.ratingValue,
    reviewCount: data.reviewCount,
    bestRating: data.bestRating ?? 5,
    worstRating: data.worstRating ?? 1,
  };
}

// ─── Schema.org Person builder ───────────────────────────────────────────────

export function buildPersonSchema(author: AuthorKOL) {
  return {
    "@type": "Person",
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.description,
    url: author.url,
    image: {
      "@type": "ImageObject",
      url: author.image,
      width: 400,
      height: 400,
    },
    sameAs: author.sameAs,
    hasCredential: author.hasCredential.map((c) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: c.credentialCategory,
      name: c.name,
      ...(c.recognizedBy
        ? { recognizedBy: { "@type": "Organization", name: c.recognizedBy } }
        : {}),
    })),
    knowsAbout: author.knowsAbout,
    ...(author.alumniOf
      ? { alumniOf: { "@type": "EducationalOrganization", name: author.alumniOf } }
      : {}),
    worksFor: {
      "@id": "https://smartdent.com.br/#organization",
    },
  };
}

// ─── BreadcrumbList builder ──────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
