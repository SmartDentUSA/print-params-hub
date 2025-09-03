// Security utilities for production environment

/**
 * Checks if the application is running in production mode
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Validates file size for uploads (max 50MB)
 */
export const validateFileSize = (file: File, maxSizeMB: number = 50): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validates file type for CSV uploads
 */
export const validateCSVFile = (file: File): boolean => {
  const allowedTypes = ['text/csv', 'application/csv', 'text/plain'];
  const allowedExtensions = ['.csv'];
  
  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  return hasValidType || hasValidExtension;
};

/**
 * Sanitizes error messages for production
 */
export const sanitizeErrorMessage = (error: unknown): string => {
  if (isProduction()) {
    // In production, return generic error messages
    return "Ocorreu um erro durante a operação. Tente novamente.";
  }
  
  // In development, return detailed error messages
  if (error instanceof Error) {
    return error.message;
  }
  
  return "Erro desconhecido";
};

/**
 * Rate limiting helper (simple implementation)
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  isAllowed(identifier: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Remove attempts outside the time window
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    
    return true;
  }
}

export const rateLimiter = new RateLimiter();