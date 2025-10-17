import { Facebook, Instagram, Linkedin, Youtube, Twitter, UserCircle } from 'lucide-react';
import { Author } from '@/hooks/useAuthors';

interface AuthorSignatureProps {
  author: Author;
}

export function AuthorSignature({ author }: AuthorSignatureProps) {
  const socialLinks = [
    { url: author.facebook_url, icon: Facebook, label: 'Facebook' },
    { url: author.instagram_url, icon: Instagram, label: 'Instagram' },
    { url: author.tiktok_url, icon: null, label: 'TikTok' },
    { url: author.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { url: author.youtube_url, icon: Youtube, label: 'YouTube' },
    { url: author.twitter_url, icon: Twitter, label: 'Twitter' },
  ].filter(link => link.url);

  return (
    <div className="mt-8 bg-gradient-card rounded-xl border border-border p-6 shadow-medium">
      <div className="flex gap-4 items-start">
        {/* Foto do autor */}
        {author.photo_url ? (
          <img 
            src={author.photo_url} 
            alt={author.name}
            className="w-20 h-20 rounded-full object-cover border-2 border-primary/20 flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20 flex-shrink-0">
            <UserCircle className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Sobre o autor
          </p>
          <h4 className="text-lg font-bold text-foreground">{author.name}</h4>
          {author.specialty && (
            <p className="text-sm text-muted-foreground">{author.specialty}</p>
          )}
          
          {/* Ícones sociais abaixo do nome */}
          {socialLinks.length > 0 && (
            <div className="flex gap-2 mt-2">
              {socialLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                  aria-label={link.label}
                >
                  {link.icon ? (
                    <link.icon className="w-4 h-4 text-primary" />
                  ) : (
                    <span className="text-primary font-bold text-xs">TT</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mini bio em caixa - fora do flex principal */}
      {author.mini_bio && (
        <div className="mt-4 bg-muted/30 rounded-lg p-4 border border-border">
          <p className="text-sm text-foreground/80 leading-relaxed">{author.mini_bio}</p>
        </div>
      )}

      {/* Currículo Lattes */}
      {author.lattes_url && (
        <a
          href={author.lattes_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-primary hover:underline"
        >
          Ver Currículo Lattes
        </a>
      )}
    </div>
  );
}
