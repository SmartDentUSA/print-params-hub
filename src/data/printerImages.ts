// Printer Images Mapping
// This file maps printer model slugs to their respective image URLs

// Import statements for all printer images
import elegooMars2 from '@/assets/printers/elegoo-mars-2.jpg';
import elegooSaturn3Ultra from '@/assets/printers/elegoo-saturn-3-ultra.jpg';
import anycubicPhotonMonoX6K from '@/assets/printers/anycubic-photon-mono-x-6k.jpg';
import creativHalotOnePro from '@/assets/printers/creality-halot-one-pro.jpg';
import phrozenSonicMini8K from '@/assets/printers/phrozen-sonic-mini-8k.jpg';
import flashforgeHunter from '@/assets/printers/flashforge-hunter.jpg';
import miicraftUltraPlus from '@/assets/printers/miicraft-ultra-plus.jpg';
import sprintrayPro95 from '@/assets/printers/sprintray-pro-95.jpg';
import straumannCaresP40 from '@/assets/printers/straumann-cares-p40.jpg';
import unizSlashPlus from '@/assets/printers/uniz-slash-plus.jpg';
import wanhaoDuplicatorD7 from '@/assets/printers/wanhao-duplicator-d7.png';
import ezy3dDentalPro from '@/assets/printers/ezy3d-dental-pro.jpg';
import anycubicPhotonM5 from '@/assets/printers/anycubic-photon-m5.jpg';
import pionextMoai200 from '@/assets/printers/pionext-moai-200.jpg';

// Mapping object for printer images
export const printerImages: Record<string, string> = {
  // ELEGOO Models
  'mars-2': elegooMars2,
  'mars-rgb': elegooMars2, // Using Mars 2 image as fallback
  'mars-3-pro': elegooMars2, // Using Mars 2 image as fallback
  'mars-4-ultra': elegooMars2, // Using Mars 2 image as fallback
  'mars-4-ultra-dlp': elegooMars2, // Using Mars 2 image as fallback
  'mars-5': elegooMars2, // Using Mars 2 image as fallback
  'mars-5-ultra': elegooMars2, // Using Mars 2 image as fallback
  'saturn-2': elegooSaturn3Ultra, // Using Saturn 3 Ultra as fallback
  'saturn-3': elegooSaturn3Ultra, // Using Saturn 3 Ultra as fallback
  'saturn-3-ultra': elegooSaturn3Ultra,
  'saturn-4-ultra': elegooSaturn3Ultra, // Using Saturn 3 Ultra as fallback

  // AnyCubic Models
  'mono-x': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-d2-dlp': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-m2': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-m5': anycubicPhotonM5,
  'photon-m5s': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-2': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-4-ultra-10k': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-4k': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-m7': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-m7-pro': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-ms5': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-se': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-s': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-4': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-w3d': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'ultra-dlp': anycubicPhotonMonoX6K, // Using Mono X 6K as fallback
  'photon-mono-x-6k': anycubicPhotonMonoX6K,

  // Creality Models
  'hallot-one': creativHalotOnePro, // Using Halot One Pro as fallback
  'hallot-r6': creativHalotOnePro, // Using Halot One Pro as fallback
  'hallot-sky': creativHalotOnePro, // Using Halot One Pro as fallback
  'hallot-one-pro-plus': creativHalotOnePro,

  // DentalFactory Models
  'ds200': ezy3dDentalPro, // Using EZY3D as fallback

  // EZY3D Models
  'ezy3d': ezy3dDentalPro,

  // Flashforge Models
  'hunter': flashforgeHunter,

  // Miicraft Models
  '100-ultra': miicraftUltraPlus, // Using Ultra Plus as fallback
  '125-ultra': miicraftUltraPlus, // Using Ultra Plus as fallback
  '150-ultra': miicraftUltraPlus, // Using Ultra Plus as fallback
  'alpha': miicraftUltraPlus, // Using Ultra Plus as fallback
  'plus': miicraftUltraPlus, // Using Ultra Plus as fallback
  'ultra-plus': miicraftUltraPlus,
  'prime-hd': miicraftUltraPlus, // Using Ultra Plus as fallback

  // Phrozen Models
  'linha-shuffle': phrozenSonicMini8K, // Using Sonic Mini 8K as fallback
  'linha-sonic-4k-sonic-3d': phrozenSonicMini8K, // Using Sonic Mini 8K as fallback
  'linha-sonic-mighty-4k': phrozenSonicMini8K, // Using Sonic Mini 8K as fallback
  'linha-sonic-mini-4k': phrozenSonicMini8K, // Using Sonic Mini 8K as fallback
  'linha-sonic-mini-8k': phrozenSonicMini8K,
  'sonic-mega-8k': phrozenSonicMini8K, // Using Sonic Mini 8K as fallback

  // Pionext Models
  'dj89': sprintrayPro95, // Using SprintRay as fallback
  'dj89-pro': sprintrayPro95, // Using SprintRay as fallback
  'moai-200': pionextMoai200,

  // SprintRay Models
  'moonray-s': sprintrayPro95,
  'pro-95': sprintrayPro95,

  // Straumann Models
  'cares-p30': straumannCaresP40, // Using P40 as fallback
  'cares-p40': straumannCaresP40,

  // UNIZ Models
  'slash-2': unizSlashPlus, // Using Slash Plus as fallback
  'slash-plus': unizSlashPlus,

  // Wanhao Models
  'duplicator-7': wanhaoDuplicatorD7,
  'd7-plus': wanhaoDuplicatorD7, // Using D7 as fallback
};

// Function to get printer image by slug
export const getPrinterImage = (slug: string): string | undefined => {
  return printerImages[slug];
};

// Function to check if a printer has an image
export const hasPrinterImage = (slug: string): boolean => {
  return slug in printerImages;
};

// Default placeholder image (you can replace this with an actual placeholder)
export const DEFAULT_PRINTER_IMAGE = '/placeholder.svg';