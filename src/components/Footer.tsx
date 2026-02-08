import { Instagram, Youtube, Facebook, Linkedin, Twitter, Mail, Phone, MapPin } from "lucide-react";
import { useCompanyData } from "@/hooks/useCompanyData";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getKnowledgeBasePath } from "@/utils/i18nPaths";

export function Footer() {
  const { data: company } = useCompanyData();
  const { t, language } = useLanguage();

  if (!company) return null;

  const socialLinks = [
    { icon: Instagram, url: company.social_media.instagram, label: "Instagram" },
    { icon: Youtube, url: company.social_media.youtube, label: "YouTube" },
    { icon: Facebook, url: company.social_media.facebook, label: "Facebook" },
    { icon: Linkedin, url: company.social_media.linkedin, label: "LinkedIn" },
    { icon: Twitter, url: company.social_media.twitter, label: "Twitter" },
  ].filter(link => link.url);

  const aboutPath = language === 'en' ? '/sobre' : language === 'es' ? '/sobre' : '/sobre';

  return (
    <footer className="bg-gradient-surface border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            {company.logo_url && (
              <img 
                src={company.logo_url} 
                alt={company.name}
                className="h-12 w-auto object-contain"
              />
            )}
            <h3 className="text-lg font-semibold text-foreground">{company.name}</h3>
            <p className="text-sm text-muted-foreground">{company.description}</p>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">{t('footer.contact')}</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              {company.contact.email && (
                <a href={`mailto:${company.contact.email}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Mail className="w-4 h-4" />
                  {company.contact.email}
                </a>
              )}
              {company.contact.phone && (
                <a href={`tel:${company.contact.phone}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Phone className="w-4 h-4" />
                  {company.contact.phone}
                </a>
              )}
              {company.contact.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {company.contact.address}
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">{t('footer.links')}</h4>
            <div className="space-y-2 text-sm">
              <Link to={aboutPath} className="block text-muted-foreground hover:text-foreground transition-colors">
                {t('footer.about_us')}
              </Link>
              <Link to={getKnowledgeBasePath(language)} className="block text-muted-foreground hover:text-foreground transition-colors">
                {t('footer.knowledge_base')}
              </Link>
              {company.institutional_links?.slice(0, 3).map((link, index) => (
                <a 
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Social Media */}
          {socialLinks.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-foreground">{t('footer.social')}</h4>
              <div className="flex gap-3">
                {socialLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      className="w-10 h-10 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-all flex items-center justify-center"
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {company.name}. {t('common.all_rights_reserved')}.</p>
        </div>
      </div>
    </footer>
  );
}
