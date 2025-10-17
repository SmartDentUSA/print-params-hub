import { Facebook, Instagram, Linkedin, Youtube, Twitter } from 'lucide-react';
import { Author } from '@/hooks/useAuthors';

interface AuthorBioProps {
  author: Author;
}

export function AuthorBio({ author }: AuthorBioProps) {
  const socialLinks = [
    { url: author.facebook_url, icon: Facebook, label: 'Facebook' },
    { url: author.instagram_url, icon: Instagram, label: 'Instagram' },
    { url: author.tiktok_url, icon: null, label: 'TikTok' },
    { url: author.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { url: author.youtube_url, icon: Youtube, label: 'YouTube' },
    { url: author.twitter_url, icon: Twitter, label: 'Twitter' },
  ].filter(link => link.url);

  return (
    <div className="bg-gradient-card rounded-xl border border-border p-6 shadow-medium">
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Foto do autor */}
        {author.photo_url && (
          <img 
            src={author.photo_url} 
            alt={author.name}
            className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
          />
        )}
        
        {/* Nome e especialidade */}
        <div>
          <h3 className="text-2xl font-bold text-foreground">{author.name}</h3>
          {author.specialty && (
            <p className="text-sm text-muted-foreground mt-1">{author.specialty}</p>
          )}
        </div>

        {/* Mini currículo */}
        {author.mini_bio && (
          <p className="text-sm text-foreground/80 max-w-md">{author.mini_bio}</p>
        )}

        {/* Ícones sociais */}
        {socialLinks.length > 0 && (
          <div className="flex gap-3 pt-2">
            {socialLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                aria-label={link.label}
              >
                {link.icon ? (
                  <link.icon className="w-5 h-5 text-primary" />
                ) : (
                  <span className="text-primary font-bold text-sm">TT</span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* Currículo Lattes */}
        {author.lattes_url && (
          <a
            href={author.lattes_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Ver Currículo Lattes
          </a>
        )}
      </div>
    </div>
  );
}
