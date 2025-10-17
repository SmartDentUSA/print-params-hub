import { Facebook, Instagram, Linkedin, Youtube, Twitter, UserCircle } from 'lucide-react';
import { Author } from '@/hooks/useAuthors';

interface AuthorSignatureProps {
  author: Author;
}

export function AuthorSignature({ author }: AuthorSignatureProps) {
  const socialBrandColors: { [key: string]: string } = {
    'Facebook': 'bg-[#1877F2]',
    'Instagram': 'bg-gradient-to-br from-[#feda75] via-[#d62976] via-[#962fbf] to-[#4f5bd5]',
    'TikTok': 'bg-black',
    'LinkedIn': 'bg-[#0A66C2]',
    'YouTube': 'bg-[#FF0000]',
    'Twitter': 'bg-black',
  };

  const socialLinks = [
    { url: author.facebook_url, icon: Facebook, label: 'Facebook' },
    { url: author.instagram_url, icon: Instagram, label: 'Instagram' },
    { url: author.tiktok_url, icon: null, label: 'TikTok' },
    { url: author.linkedin_url, icon: Linkedin, label: 'LinkedIn' },
    { url: author.youtube_url, icon: Youtube, label: 'YouTube' },
    { url: author.twitter_url, icon: Twitter, label: 'Twitter' },
  ].filter(link => link.url);

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 shadow-md">
      <div className="flex gap-4 items-start">
        {/* Foto do autor */}
        {author.photo_url ? (
          <img 
            src={author.photo_url} 
            alt={author.name}
            className="w-20 h-20 rounded-full object-cover border-2 border-black flex-shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-black flex-shrink-0">
            <UserCircle className="w-12 h-12 text-gray-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Sobre o autor
              </p>
              <h4 className="text-lg font-extrabold uppercase text-black leading-tight">{author.name}</h4>
              {author.specialty && (
                <p className="text-sm text-gray-500 mt-1">{author.specialty}</p>
              )}
            </div>
            
            {/* Ícones sociais à direita */}
            {socialLinks.length > 0 && (
              <div className="flex gap-2 flex-wrap items-start">
                {socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-8 h-8 rounded-full ${socialBrandColors[link.label]} hover:opacity-90 flex items-center justify-center transition-opacity`}
                    aria-label={link.label}
                  >
                    {link.icon ? (
                      <link.icon className="w-[18px] h-[18px] text-white" />
                    ) : (
                      <span className="text-white font-bold text-[11px]">TT</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Caixa Mini Currículo */}
          <div className="rounded-[20px] border-2 border-black p-4">
            {author.mini_bio ? (
              <p className="text-sm text-black leading-relaxed text-left">{author.mini_bio}</p>
            ) : (
              <p className="text-base font-semibold text-black text-center">Mini Currículo</p>
            )}
          </div>

          {/* Currículo Lattes */}
          {author.lattes_url && (
            <a
              href={author.lattes_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-[#1877F2] hover:underline"
            >
              Ver Currículo Lattes
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
