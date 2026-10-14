import { getPublicSiteOrigin } from "@/utils/publicSite";
import { Helmet } from "react-helmet-async";
import { useCompanyData } from "@/hooks/useCompanyData";

export function OrganizationSchema() {
  const { data: company } = useCompanyData();

  if (!company) return null;

  const baseUrl = getPublicSiteOrigin();
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    
    // Core Identity
    "name": company.name,
    "legalName": company.business?.legal_name,
    "alternateName": company.business?.doing_business_as,
    "taxID": company.business?.cnpj || company.business?.tax_id,
    "vatID": company.business?.cnpj || company.business?.vat_id,
    "description": company.description,
    "url": company.website_url,
    "logo": company.logo_url,
    "foundingDate": company.business?.founded_year ? `${company.business.founded_year}-01-01` : (company.corporate.founded_year ? `${company.corporate.founded_year}-01-01` : undefined),
    
    // FASE 2: E-E-A-T Enhancement (Expertise, Authoritativeness, Trustworthiness)
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
    
    // The certificates and awards are maintained in the verified company record.
    // Google's self-serving-review rule is separate: API-imported business ratings
    // are not marked up here because Google excludes Organization review stars.
    "award": [
      ...(company.corporate?.certifications || []),
      ...(company.corporate?.awards?.map(a => `${a.name} (${a.year}) - ${a.issuer}`) || []),
    ],
    
    // Corporate Data
    "numberOfEmployees": company.business?.number_of_employees,
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
        "@id": `${baseUrl}/#organization-us`,
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
      "@id": `${baseUrl}/#founder-${f.name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`,
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
