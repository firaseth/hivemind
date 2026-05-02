/**
 * 1.3 Robust Error Handling & Retry Logic
 * Implements exponential backoff for API calls.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { 
    maxRetries?: number; 
    backoffMs?: number; 
    onRetry?: (attempt: number, error: any) => void 
  } = {}
): Promise<T> {
  const { maxRetries = 3, backoffMs = 500, onRetry } = options;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt > maxRetries) {
        console.error(`[Retry] Failed after ${maxRetries} attempts:`, err);
        throw err;
      }
      
      onRetry?.(attempt, err);
      
      // Exponential backoff
      const delay = backoffMs * 2 ** (attempt - 1);
      console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  
  throw new Error('Unreachable');
}
