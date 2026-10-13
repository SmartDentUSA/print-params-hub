export const LEGACY_CATALOG_DESTINATION='/base-conhecimento?tab=catalogo&cat=resinas_3d';
export function legacyPublicRedirect(path) {
  if(typeof path!=='string')return null;
  try {
    const normalized=decodeURIComponent(path).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\/$/,'');
    return normalized==='/caracterizacao' ? LEGACY_CATALOG_DESTINATION : null;
  } catch {return null;}
}
