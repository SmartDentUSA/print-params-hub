import { Author } from '@/hooks/useAuthors';

export function generateAuthorSignatureHTML(author: Author): string {
  // Cores das marcas das redes sociais
  const socialBrandColors: { [key: string]: string } = {
    'Facebook': '#1877F2',
    'Instagram': 'linear-gradient(45deg, #feda75, #d62976, #962fbf, #4f5bd5)',
    'TikTok': '#000000',
    'LinkedIn': '#0A66C2',
    'YouTube': '#FF0000',
    'Twitter': '#000000',
  };

  // Filtrar redes sociais com URL
  const socialLinks = [
    { url: author.facebook_url, label: 'Facebook', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' },
    { url: author.instagram_url, label: 'Instagram', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>' },
    { url: author.tiktok_url, label: 'TikTok', iconText: 'TT' },
    { url: author.linkedin_url, label: 'LinkedIn', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>' },
    { url: author.youtube_url, label: 'YouTube', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><polygon points="10 15 15 12 10 9 10 15"/></svg>' },
    { url: author.twitter_url, label: 'Twitter', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>' },
  ].filter(link => link.url);

  const photoHTML = author.photo_url
    ? `<img 
        src="${author.photo_url}" 
        alt="${author.name}"
        style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #111111; flex-shrink: 0;"
      />`
    : `<div style="width: 80px; height: 80px; border-radius: 50%; background: #f1f1f1; display: flex; align-items: center; justify-content: center; border: 2px solid #111111; flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>`;

  const socialLinksHTML = socialLinks.length > 0
    ? socialLinks.map(link => {
        const bgColor = socialBrandColors[link.label] || '#111111';
        return `<a
            href="${link.url}"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 32px; height: 32px; border-radius: 50%; background: ${bgColor}; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; flex-shrink: 0;"
            aria-label="${link.label}"
          >
            ${link.iconSvg ? `<span style="color: #ffffff;">${link.iconSvg}</span>` : `<span style="color: #ffffff; font-weight: bold; font-size: 11px;">${link.iconText}</span>`}
          </a>`;
      }).join('')
    : '';

  const miniBioHTML = author.mini_bio
    ? `<p style="font-size: 14px; color: #111111; line-height: 1.6; margin: 0; text-align: left;">${author.mini_bio}</p>`
    : `<p style="font-size: 16px; color: #111111; font-weight: 600; margin: 0; text-align: center;">Mini Currículo</p>`;

  const lattesHTML = author.lattes_url
    ? `<a
        href="${author.lattes_url}"
        target="_blank"
        rel="noopener noreferrer"
        style="display: inline-block; margin-top: 12px; font-size: 14px; color: #1877F2; text-decoration: none;"
      >
        Ver Currículo Lattes
      </a>`
    : '';

  return `
<div style="margin-top: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
  <div style="display: flex; gap: 16px; align-items: flex-start;">
    ${photoHTML}
    
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;">
        <div style="flex: 1; min-width: 0;">
          <p style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">
            Sobre o autor
          </p>
          <h4 style="font-size: 18px; font-weight: 800; text-transform: uppercase; color: #111111; margin: 0; line-height: 1.2; word-wrap: break-word;">${author.name}</h4>
          ${author.specialty ? `<p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0; word-wrap: break-word;">${author.specialty}</p>` : ''}
        </div>
        ${socialLinksHTML ? `<div style="display: flex; gap: 8px; flex-wrap: wrap;">${socialLinksHTML}</div>` : ''}
      </div>
      
      <div style="border: 2px solid #e5e7eb; border-radius: 20px; padding: 16px;">
        ${miniBioHTML}
      </div>
      
      ${lattesHTML}
    </div>
  </div>
</div>
  `.trim();
}
