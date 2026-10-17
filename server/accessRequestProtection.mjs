import { isIP } from "node:net";

export const accessRequestLimits = { hourly: 100, pending: 200 };

// Only the loopback Nginx listener may provide this header, and only when enabled.
// Nginx must overwrite it with Cloudflare's visitor IP. Never trust raw forwarded headers.
export function accessRequestIp(request, trustProxy = false) {
  const peer = request.socket?.remoteAddress;
  const forwarded = request.headers?.["x-access-request-ip"];
  if (trustProxy && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer) && typeof forwarded === "string" && isIP(forwarded)) return forwarded;
  return request.ip ?? peer ?? "unknown";
}

export async function verifyAccessRequestToken(token, ip, { secret, hostnames = [], required = true } = {}, fetchImpl = fetch) {
  if (!required) return true;
  if (!secret || !hostnames.length || typeof token !== "string" || !token.trim() || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (isIP(ip)) body.set("remoteip", ip);
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true && result.action === "request_access" && hostnames.includes(result.hostname);
  } catch { return false; }
}
