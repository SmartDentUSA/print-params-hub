import { Helmet } from "react-helmet-async";
import { useCompanyData } from "@/hooks/useCompanyData";

export function OrganizationSchema() {
  const { data: company } = useCompanyData();

  if (!company) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": company.name,
    "description": company.description,
    "url": company.website_url,
    "logo": company.logo_url,
    "foundingDate": company.corporate.founded_year ? `${company.corporate.founded_year}-01-01` : undefined,
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": company.contact.phone,
      "email": company.contact.email,
      "contactType": "customer service",
    },
    "address": company.contact.address ? {
      "@type": "PostalAddress",
      "streetAddress": company.contact.address,
    } : undefined,
    "sameAs": [
      company.social_media.instagram,
      company.social_media.youtube,
      company.social_media.facebook,
      company.social_media.linkedin,
      company.social_media.twitter,
    ].filter(Boolean),
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}
