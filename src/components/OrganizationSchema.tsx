import { Helmet } from "react-helmet-async";
import { useCompanyData } from "@/hooks/useCompanyData";

export function OrganizationSchema() {
  const { data: company } = useCompanyData();

  if (!company) return null;

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Organization",
    
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
