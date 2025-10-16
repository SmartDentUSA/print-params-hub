/**
 * Configuração centralizada da API externa do Sistema A (landing-craftsman-76)
 */
export const EXTERNAL_API_CONFIG = {
  // Sistema A (landing-craftsman-76)
  PRODUCTS_API_URL: 'https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/get-product-data',
  
  // Parâmetros padrão
  DEFAULT_PARAMS: {
    approved: 'true'
  }
} as const;
