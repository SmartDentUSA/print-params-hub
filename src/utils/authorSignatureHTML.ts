import { Author } from '@/hooks/useAuthors';

export function generateAuthorSignatureHTML(author: Author): string {
  // Filtrar redes sociais com URL
  const socialLinks = [
    { url: author.facebook_url, label: 'Facebook', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' },
    { url: author.instagram_url, label: 'Instagram', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>' },
    { url: author.tiktok_url, label: 'TikTok', iconText: 'TT' },
    { url: author.linkedin_url, label: 'LinkedIn', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>' },
    { url: author.youtube_url, label: 'YouTube', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><polygon points="10 15 15 12 10 9 10 15"/></svg>' },
    { url: author.twitter_url, label: 'Twitter', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>' },
  ].filter(link => link.url);

  const photoHTML = author.photo_url
    ? `<img 
        src="${author.photo_url}" 
        alt="${author.name}"
        style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid hsl(var(--primary) / 0.2); flex-shrink: 0;"
      />`
    : `<div style="width: 80px; height: 80px; border-radius: 50%; background: hsl(var(--muted)); display: flex; align-items: center; justify-content: center; border: 2px solid hsl(var(--primary) / 0.2); flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>`;

  const socialLinksHTML = socialLinks.length > 0
    ? `<div style="display: flex; gap: 8px; flex-shrink: 0;">
        ${socialLinks.map(link => `
          <a
            href="${link.url}"
            target="_blank"
            rel="noopener noreferrer"
            style="width: 32px; height: 32px; border-radius: 50%; background: hsl(var(--primary) / 0.1); display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; text-decoration: none;"
            aria-label="${link.label}"
          >
            ${link.iconSvg ? `<span style="color: hsl(var(--primary));">${link.iconSvg}</span>` : `<span style="color: hsl(var(--primary)); font-weight: bold; font-size: 12px;">${link.iconText}</span>`}
          </a>
        `).join('')}
      </div>`
    : '';

  const miniBioHTML = author.mini_bio
    ? `<div style="background: hsl(var(--muted) / 0.3); border-radius: 8px; padding: 16px; border: 1px solid hsl(var(--border));">
        <p style="font-size: 14px; color: hsl(var(--foreground) / 0.8); line-height: 1.6; margin: 0;">${author.mini_bio}</p>
      </div>`
    : '';

  const lattesHTML = author.lattes_url
    ? `<a
        href="${author.lattes_url}"
        target="_blank"
        rel="noopener noreferrer"
        style="display: inline-block; margin-top: 12px; font-size: 14px; color: hsl(var(--primary)); text-decoration: none;"
      >
        Ver Currículo Lattes
      </a>`
    : '';

  return `
<div style="margin-top: 32px; background: linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 100%); border-radius: 12px; border: 1px solid hsl(var(--border)); padding: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);">
  <div style="display: flex; gap: 16px; align-items: flex-start;">
    ${photoHTML}
    
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px;">
        <div>
          <p style="font-size: 12px; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">
            Sobre o autor
          </p>
          <h4 style="font-size: 18px; font-weight: bold; color: hsl(var(--foreground)); margin: 0;">${author.name}</h4>
          ${author.specialty ? `<p style="font-size: 14px; color: hsl(var(--muted-foreground)); margin: 4px 0 0 0;">${author.specialty}</p>` : ''}
        </div>
        ${socialLinksHTML}
      </div>

      ${miniBioHTML}
      ${lattesHTML}
    </div>
  </div>
</div>
  `.trim();
}
