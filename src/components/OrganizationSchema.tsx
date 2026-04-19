import { Helmet } from "react-helmet-async";
import { useCompanyData } from "@/hooks/useCompanyData";

export function OrganizationSchema() {
  const { data: company } = useCompanyData();

  if (!company) return null;

  const schema: any = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "Store"],
    "@id": "https://parametros.smartdent.com.br/#organization",
    
    // Core Identity
    "name": company.name,
    "legalName": company.business?.legal_name,
    "alternateName": company.business?.doing_business_as,
    "description": company.description,
    "url": company.website_url,
    "logo": company.logo_url,
    "foundingDate": company.corporate.founded_year ? `${company.corporate.founded_year}-01-01` : undefined,
    
    // FASE 2: E-E-A-T Enhancement (Expertise, Authoritativeness, Trustworthiness)
    "expertise": "Fabricação de resinas odontológicas para impressão 3D, desenvolvimento de parâmetros de impressão otimizados",
    "knowsAbout": [
      "Impressão 3D odontológica",
      "Resinas fotopolimerizáveis",
      "Biocompatibilidade dental",
      "Prótese dentária digital",
      "Ortodontia digital",
      "Planejamento virtual odontológico",
      ...(company.seo?.technical_expertise || []),
      ...(company.seo?.context_keywords || []),
    ].filter(Boolean),
    
    // Contact Points - Expanded
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": company.contact.phone,
        "email": company.contact.email,
        "contactType": "customer service",
        "availableLanguage": company.contact.languages_spoken,
        "hoursAvailable": company.contact.support_hours,
      },
      company.contact.emergency_contact ? {
        "@type": "ContactPoint",
        "telephone": company.contact.emergency_contact,
        "contactType": "emergency",
      } : null,
      company.contact.whatsapp ? {
        "@type": "ContactPoint",
        "telephone": company.contact.whatsapp,
        "contactType": "customer support",
        "contactOption": "TollFree",
      } : null,
    ].filter(Boolean),
    
    // Complete Address
    "address": {
      "@type": "PostalAddress",
      "streetAddress": company.contact.address,
      "addressLocality": company.contact.city,
      "addressRegion": company.contact.state,
      "postalCode": company.contact.postal_code,
      "addressCountry": company.contact.country,
    },
    
    // GeoCoordinates (LocalBusiness SEO - Google Maps/Local Pack)
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -22.0154,
      "longitude": -47.8911
    },
    
    // Opening Hours (LocalBusiness SEO)
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "08:00",
        "closes": "18:00"
      }
    ],
    
    // Telephone for LocalBusiness
    "telephone": company.contact.phone,
    
    // Social Media Links
    "sameAs": [
      company.social_media.instagram,
      company.social_media.youtube,
      company.social_media.facebook,
      company.social_media.linkedin,
      company.social_media.twitter,
      company.social_media.tiktok,
    ].filter(Boolean),
    
    // ⭐ CRITICAL FOR GOOGLE: Aggregate Ratings
    "aggregateRating": company.reviews_reputation?.google_rating ? {
      "@type": "AggregateRating",
      "ratingValue": company.reviews_reputation.google_rating,
      "reviewCount": company.reviews_reputation.google_review_count || company.reviews_reputation.testimonial_count,
      "bestRating": "5",
      "worstRating": "1",
    } : undefined,
    
    // FASE 2: Awards and Certifications (E-E-A-T Enhancement)
    "award": [
      "Certificação ISO 13485 - Dispositivos Médicos",
      "Registro ANVISA para resinas odontológicas",
      ...(company.corporate?.awards?.map(a => `${a.name} (${a.year}) - ${a.issuer}`) || [])
    ].filter(Boolean),
    "accreditation": company.corporate?.certifications || [],
    "certifications": [
      {
        "@type": "Certification",
        "name": "ISO 13485",
        "description": "Sistema de gestão da qualidade para dispositivos médicos"
      },
      {
        "@type": "Certification", 
        "name": "ANVISA",
        "description": "Registro sanitário para comercialização de resinas odontológicas no Brasil"
      }
    ],
    
    // Corporate Data
    "numberOfEmployees": company.business?.number_of_employees,
    "vatID": company.business?.vat_id,
    "taxID": company.business?.tax_id,
    "duns": company.business?.duns_number,
    
    // Mission & Values
    "slogan": company.corporate?.mission,
    
    // Service Offerings
    "makesOffer": company.seo?.service_offerings?.map(service => ({
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": service,
      },
      "priceRange": company.seo?.price_range,
      "acceptedPaymentMethod": company.seo?.payment_methods?.map(method => ({
        "@type": "PaymentMethod",
        "name": method,
      })),
    })),
    
    // Geographic Coverage
    "areaServed": company.seo?.areas_served?.map(area => ({
      "@type": "Place",
      "name": area,
    })),
    
    // Media and Press
    "subjectOf": company.media?.media_mentions?.map(mention => ({
      "@type": "NewsArticle",
      "headline": mention.title,
      "url": mention.url,
      "publisher": {
        "@type": "Organization",
        "name": mention.publisher,
      },
      "datePublished": mention.date,
    })),

    // Parent Organization (entidade controladora EUA — MMTech NA LLC)
    "parentOrganization": (() => {
      const us = company.legal_entities?.find(e => e.country === 'US');
      if (!us) return undefined;
      return {
        "@type": "Organization",
        "@id": "https://parametros.smartdent.com.br/#organization-us",
        "name": us.legal_name,
        "alternateName": us.trade_name,
        "url": us.website,
        "foundingDate": us.founded_year ? `${us.founded_year}-01-01` : undefined,
        "identifier": us.file_number ? [{
          "@type": "PropertyValue",
          "propertyID": "NC-SOS-File-Number",
          "value": us.file_number,
        }] : undefined,
        "address": us.address ? {
          "@type": "PostalAddress",
          "streetAddress": us.address.street,
          "addressLocality": us.address.city,
          "addressRegion": us.address.state,
          "postalCode": us.address.postal_code,
          "addressCountry": us.address.country,
        } : undefined,
        "telephone": us.phone,
        "memberOf": us.partnership ? {
          "@type": "Organization",
          "name": us.partnership,
        } : undefined,
      };
    })(),

    // Founders (Person Schema completo — E-E-A-T máximo)
    "founder": company.founders?.map(f => ({
      "@type": "Person",
      "@id": `https://parametros.smartdent.com.br/#founder-${f.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`,
      "name": f.name,
      "honorificSuffix": f.title,
      "jobTitle": [f.role_br, f.role_us].filter(Boolean).join(' / '),
      "identifier": [
        f.orcid ? { "@type": "PropertyValue", "propertyID": "ORCID", "value": f.orcid } : null,
        f.lattes_id ? { "@type": "PropertyValue", "propertyID": "Lattes", "value": f.lattes_id } : null,
      ].filter(Boolean),
      "sameAs": [f.orcid_url, f.lattes_url, f.fapesp_url].filter(Boolean),
      "alumniOf": (f.education || []).map(ed => ({
        "@type": "CollegeOrUniversity",
        "name": ed.institution,
      })),
      "hasCredential": (f.education || []).map(ed => ({
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "educationalLevel": ed.degree,
        "about": ed.field,
      })),
      "knowsAbout": f.knows_about || [],
    })),

    // Responsável Técnico (CRO-SP — exigência ANVISA)
    "employee": company.responsible_technician ? [{
      "@type": "Person",
      "name": company.responsible_technician.name,
      "jobTitle": "Responsável Técnico",
      "identifier": [{
        "@type": "PropertyValue",
        "propertyID": company.responsible_technician.council,
        "value": company.responsible_technician.license_number,
      }],
    }] : undefined,

    // Pesquisa financiada (autoridade científica)
    "funding": company.research_grants?.map(g => ({
      "@type": "Grant",
      "name": g.title,
      "funder": { "@type": "Organization", "name": g.funder },
      "identifier": g.grant_id,
      "description": [g.program, g.period].filter(Boolean).join(' · '),
    })),
  };

  // Remove undefined fields to keep schema clean
  const cleanSchema = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.filter(item => item !== undefined && item !== null).map(cleanSchema);
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value) && value.length === 0) return acc;
          if (typeof value === 'object' && Object.keys(value).length === 0) return acc;
          acc[key] = cleanSchema(value);
        }
        return acc;
      }, {} as any);
    }
    return obj;
  };

  const finalSchema = cleanSchema(schema);

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(finalSchema)}
      </script>
    </Helmet>
  );
}
