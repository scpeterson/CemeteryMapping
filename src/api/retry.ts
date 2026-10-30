import { ApiError } from "./apiClient";

const transientStatuses = new Set([0, 408, 429, 500, 502, 503, 504]);

export function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  { attempts = 5, signal, delay = abortableDelay }: {
    attempts?: number; signal?: AbortSignal; delay?: typeof abortableDelay;
  } = {},
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError("Attempts must be a positive integer.");
  for (let attempt = 1; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const result = await operation();
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt >= attempts || !(error instanceof ApiError) || !transientStatuses.has(error.status)) throw error;
      await delay(200 * attempt, signal);
    }
  }
}
