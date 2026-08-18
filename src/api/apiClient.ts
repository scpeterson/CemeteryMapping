type AccessTokenProvider = () => Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider | undefined;

export const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/u, "");

export function setAccessTokenProvider(provider: AccessTokenProvider | undefined) {
  accessTokenProvider = provider;
}

export async function authorizedFetch(url: string, init?: RequestInit) {
  const token = await accessTokenProvider?.();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function responseErrorDetail(response: Response) {
  try {
    const body = (await response.clone().json()) as { error?: unknown };
    return typeof body.error === "string" && body.error.trim() ? `: ${body.error.trim()}` : "";
  } catch {
    return "";
  }
}

export async function jsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const detail = await responseErrorDetail(response);
    throw new Error(`${label} returned ${response.status}${detail}`);
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
