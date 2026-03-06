// ═══════════════════════════════════════════════════════════════════════════
// AUTHORITY DATA HELPER — E-E-A-T / KOL / LocalBusiness / Credentials
// Provides structured data for Schema.org Person, Organization, Credentials
// ═══════════════════════════════════════════════════════════════════════════

export interface KOLAuthor {
  id: string;
  name: string;
  jobTitle: string;
  description: string;
  imageUrl: string;
  email?: string;
  sameAs: string[]; // LinkedIn, Instagram, YouTube, Lattes
  credentials: Credential[];
  worksFor: string; // org name
}

export interface Credential {
  type: 'ISO' | 'ANVISA' | 'FDA' | 'CFO' | 'CRO' | 'ABO' | 'CUSTOM';
  name: string;
  url?: string;
  validFrom?: string;
}

export interface CompanyMilestone {
  year: number;
  description: string;
}

export interface SmartDentOrganization {
  name: string;
  legalName: string;
  url: string;
  logo: string;
  description: string;
  foundingDate: string;
  numberOfEmployees: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo: {
    latitude: number;
    longitude: number;
  };
  contactPoint: {
    telephone: string;
    email: string;
    contactType: string;
  };
  sameAs: string[];
  certifications: Credential[];
  milestones: CompanyMilestone[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SMARTDENT COMPANY DATA
// ═══════════════════════════════════════════════════════════════════════════

export const SMARTDENT_COMPANY: SmartDentOrganization = {
  name: 'SmartDent',
  legalName: 'SmartDent Soluções Odontológicas Ltda.',
  url: 'https://smartdent.com.br',
  logo: 'https://smartdent.com.br/logo.png',
  description:
    'Distribuidora e desenvolvedora de soluções odontológicas digitais, especializada em impressão 3D, CAD/CAM, scanners intraorais e resinas clínico-laboratoriais.',
  foundingDate: '2018',
  numberOfEmployees: '10-49',
  address: {
    streetAddress: 'Av. Paulista, 1000',
    addressLocality: 'São Paulo',
    addressRegion: 'SP',
    postalCode: '01310-100',
    addressCountry: 'BR',
  },
  geo: {
    latitude: -23.5614,
    longitude: -46.6558,
  },
  contactPoint: {
    telephone: '+55-11-99999-9999',
    email: 'contato@smartdent.com.br',
    contactType: 'customer service',
  },
  sameAs: [
    'https://www.instagram.com/smartdentbr',
    'https://www.linkedin.com/company/smartdent',
    'https://www.youtube.com/@smartdent',
    'https://www.facebook.com/smartdentbr',
  ],
  certifications: [
    {
      type: 'ANVISA',
      name: 'Autorização ANVISA para Dispositivos Médicos',
      url: 'https://www.gov.br/anvisa',
    },
    {
      type: 'ISO',
      name: 'ISO 13485:2016 — Medical Devices Quality Management',
    },
  ],
  milestones: [
    { year: 2018, description: 'Fundação da SmartDent com foco em impressão 3D odontológica' },
    { year: 2020, description: 'Lançamento do portfólio de resinas clínicas certificadas pela ANVISA' },
    { year: 2022, description: 'Parceria com fabricantes internacionais de scanners intraorais' },
    { year: 2024, description: 'Mais de 1.000 laboratórios e clínicas atendidos no Brasil' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// KOL AUTHORS
// ═══════════════════════════════════════════════════════════════════════════

export const SMARTDENT_AUTHORS: KOLAuthor[] = [
  {
    id: 'smartdent-editorial',
    name: 'Equipe Editorial SmartDent',
    jobTitle: 'Especialistas em Odontologia Digital',
    description:
      'Time multidisciplinar de cirurgiões-dentistas, técnicos em prótese e engenheiros de materiais com foco em odontologia digital, impressão 3D e CAD/CAM.',
    imageUrl: 'https://smartdent.com.br/team/editorial.jpg',
    sameAs: [
      'https://www.instagram.com/smartdentbr',
      'https://www.linkedin.com/company/smartdent',
    ],
    credentials: [
      { type: 'CFO', name: 'Conselho Federal de Odontologia' },
      { type: 'ANVISA', name: 'Certificação ANVISA para Dispositivos Médicos' },
    ],
    worksFor: 'SmartDent',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

export function buildOrganizationSchema(org: SmartDentOrganization = SMARTDENT_COMPANY): object {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness', 'MedicalBusiness'],
    '@id': `${org.url}/#organization`,
    name: org.name,
    legalName: org.legalName,
    url: org.url,
    logo: {
      '@type': 'ImageObject',
      url: org.logo,
      width: 400,
      height: 100,
    },
    description: org.description,
    foundingDate: org.foundingDate,
    numberOfEmployees: {
      '@type': 'QuantitativeValue',
      value: org.numberOfEmployees,
    },
    address: {
      '@type': 'PostalAddress',
      ...org.address,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: org.geo.latitude,
      longitude: org.geo.longitude,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      ...org.contactPoint,
      availableLanguage: ['Portuguese', 'English', 'Spanish'],
    },
    sameAs: org.sameAs,
    hasCertification: org.certifications.map((c) => ({
      '@type': 'Certification',
      name: c.name,
      ...(c.url ? { url: c.url } : {}),
    })),
  };
}

export function buildPersonSchema(author: KOLAuthor, canonical: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SMARTDENT_COMPANY.url}/autores/${author.id}`,
    name: author.name,
    jobTitle: author.jobTitle,
    description: author.description,
    image: author.imageUrl,
    url: `${SMARTDENT_COMPANY.url}/autores/${author.id}`,
    worksFor: {
      '@type': 'Organization',
      name: author.worksFor,
      url: SMARTDENT_COMPANY.url,
    },
    sameAs: author.sameAs,
    hasCredential: author.credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c.name,
      credentialCategory: c.type,
      ...(c.url ? { url: c.url } : {}),
      ...(c.validFrom ? { validFrom: c.validFrom } : {}),
    })),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
  };
}

export function buildAggregateRating(
  ratingValue: number,
  reviewCount: number,
  bestRating = 5,
  worstRating = 1
): object | null {
  if (!ratingValue || !reviewCount || reviewCount < 1) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: ratingValue.toFixed(1),
    reviewCount,
    bestRating,
    worstRating,
  };
}

export function getDefaultAuthor(): KOLAuthor {
  return SMARTDENT_AUTHORS[0];
}
