type AccessTokenProvider = () => Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider | undefined;

export const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/u, "");

export function setAccessTokenProvider(provider: AccessTokenProvider | undefined) {
  accessTokenProvider = provider;
}

export async function authorizedFetch(url: string, init?: RequestInit) {
  let token: string | undefined;
  try {
    token = await accessTokenProvider?.();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Your session could not be verified. Sign in again and try again.", 401);
  }
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try {
    return await fetch(url, { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }
}

async function responseErrorDetail(response: Response): Promise<{ error?: string; referenceId?: string }> {
  try {
    const body = (await response.clone().json()) as { error?: unknown; referenceId?: unknown } | null;
    return {
      error: typeof body?.error === "string" ? body.error.trim() : undefined,
      referenceId: typeof body?.referenceId === "string" && /^[a-zA-Z0-9-]{1,80}$/u.test(body.referenceId) ? body.referenceId : undefined,
    };
  } catch {
    return {};
  }
}

export async function jsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const detail = await responseErrorDetail(response);
    const messages: Record<number, string> = {
      400: detail.error || "Some information is invalid. Check your entries and try again.",
      401: "Your session has expired or you are signed out. Sign in again to continue.",
      403: "You don't have permission to perform this action. Contact an administrator if you need access.",
      404: "This record is no longer available. Reload the page to see the latest records.",
      409: detail.error || "This record changed while you were editing it. Reload the latest version before saving again.",
      413: detail.error && detail.error !== "Request body is too large" ? detail.error : "This upload is too large. Choose a smaller file and try again.",
      415: "This file or request format is not supported. Choose a supported format and try again.",
      422: detail.error || "Some information is invalid. Check your entries and try again.",
      429: "Too many requests were made. Wait a moment and try again.",
    };
    let message = response.status >= 500
      ? "Something went wrong on the server. Please try again. If this continues, contact an administrator."
      : messages[response.status] || "The request could not be completed. Reload the page and try again.";
    if (detail.referenceId) message += ` Reference: ${detail.referenceId}.`;
    throw new ApiError(message, response.status, label, detail.referenceId);
  }
  return (await response.json()) as T;
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly operation?: string;
  readonly referenceId?: string;
  constructor(message: string, status: number, operation?: string, referenceId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.operation = operation;
    this.referenceId = referenceId;
  }
}
