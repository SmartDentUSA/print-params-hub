// Printer Images Mapping
// This file maps printer model slugs to their respective image URLs
// Images should be managed through the admin panel

// Mapping object for printer images - URLs will be set through admin panel
export const printerImages: Record<string, string> = {
  // ELEGOO Models
  'mars-2': '',
  'mars-rgb': '',
  'mars-3-pro': '',
  'mars-4-ultra': '',
  'mars-4-ultra-dlp': '',
  'mars-5': '',
  'mars-5-ultra': '',
  'saturn-2': '',
  'saturn-3': '',
  'saturn-3-ultra': '',
  'saturn-4-ultra': '',

  // AnyCubic Models
  'mono-x': '',
  'photon-d2-dlp': '',
  'photon-m2': '',
  'photon-m5': '',
  'photon-m5s': '',
  'photon-mono-2': '',
  'photon-mono-4-ultra-10k': '',
  'photon-mono-4k': '',
  'photon-mono-m7': '',
  'photon-mono-m7-pro': '',
  'photon-mono-ms5': '',
  'photon-mono-se': '',
  'photon-s': '',
  'photon-mono-4': '',
  'photon-w3d': '',
  'ultra-dlp': '',
  'photon-mono-x-6k': '',

  // Creality Models
  'hallot-one': '',
  'hallot-r6': '',
  'hallot-sky': '',
  'hallot-one-pro-plus': '',

  // DentalFactory Models
  'ds200': '',

  // EZY3D Models
  'ezy3d': '',

  // Flashforge Models
  'hunter': '',

  // Miicraft Models
  '100-ultra': '',
  '125-ultra': '',
  '150-ultra': '',
  'alpha': '',
  'plus': '',
  'ultra-plus': '',
  'prime-hd': '',

  // Phrozen Models
  'linha-shuffle': '',
  'linha-sonic-4k-sonic-3d': '',
  'linha-sonic-mighty-4k': '',
  'linha-sonic-mini-4k': '',
  'linha-sonic-mini-8k': '',
  'sonic-mega-8k': '',

  // Pionext Models
  'dj89': '',
  'dj89-pro': '',
  'moai-200': '',

  // SprintRay Models
  'moonray-s': '',
  'pro-95': '',

  // Straumann Models
  'cares-p30': '',
  'cares-p40': '',

  // UNIZ Models
  'slash-2': '',
  'slash-plus': '',

  // Wanhao Models
  'duplicator-7': '',
  'd7-plus': '',
};

// Function to get printer image by slug
export const getPrinterImage = (slug: string): string | undefined => {
  const imageUrl = printerImages[slug];
  return imageUrl && imageUrl.trim() !== '' ? imageUrl : undefined;
};

// Function to check if a printer has an image
export const hasPrinterImage = (slug: string): boolean => {
  const imageUrl = printerImages[slug];
  return imageUrl && imageUrl.trim() !== '';
};

// Function to update printer image (for admin use)
export const updatePrinterImage = (slug: string, imageUrl: string): void => {
  printerImages[slug] = imageUrl;
};

// Default placeholder image
export const DEFAULT_PRINTER_IMAGE = '/placeholder.svg';