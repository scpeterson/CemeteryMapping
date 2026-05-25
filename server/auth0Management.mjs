import { randomBytes } from "node:crypto";

function normalizeDomain(domain) {
  return String(domain ?? "").replace(/^https?:\/\//u, "").replace(/\/$/u, "");
}

function auth0ApiBaseUrl(domain) {
  return `https://${normalizeDomain(domain)}`;
}

function isConfigured(config) {
  return Boolean(config?.domain && config?.clientId && config?.clientSecret && config?.connection);
}

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}aA1!`;
}

async function jsonOrText(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function auth0ErrorMessage(label, response, body) {
  if (typeof body === "object" && body) {
    const message = body.message ?? body.error_description ?? body.error;
    if (message) return `${label} returned ${response.status}: ${message}`;
  }
  return `${label} returned ${response.status}`;
}

export class Auth0ProvisioningNotConfiguredError extends Error {
  constructor() {
    super("Auth0 user provisioning is not configured.");
  }
}

export function createAuth0ManagementClient(config, fetchImpl = globalThis.fetch) {
  let cachedToken;
  let tokenExpiresAt = 0;

  async function requestManagementToken() {
    if (!isConfigured(config)) throw new Auth0ProvisioningNotConfiguredError();
    if (!fetchImpl) throw new Error("Fetch is not available for Auth0 Management API calls.");
    if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

    const domain = normalizeDomain(config.domain);
    const response = await fetchImpl(`${auth0ApiBaseUrl(domain)}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
    });
    const body = await jsonOrText(response);
    if (!response.ok) throw new Error(auth0ErrorMessage("Auth0 token API", response, body));

    cachedToken = body.access_token;
    tokenExpiresAt = Date.now() + Number(body.expires_in ?? 0) * 1000;
    return cachedToken;
  }

  async function managementRequest(path, init = {}) {
    const token = await requestManagementToken();
    const response = await fetchImpl(`${auth0ApiBaseUrl(config.domain)}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const body = await jsonOrText(response);
    if (!response.ok) throw new Error(auth0ErrorMessage("Auth0 Management API", response, body));
    return body;
  }

  async function findUserByEmail(email) {
    const users = await managementRequest(`/api/v2/users-by-email?email=${encodeURIComponent(email)}`);
    return Array.isArray(users) ? users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) : undefined;
  }

  async function createUser({ email, displayName }) {
    return managementRequest("/api/v2/users", {
      method: "POST",
      body: JSON.stringify({
        connection: config.connection,
        email,
        name: displayName || email,
        password: temporaryPassword(),
        verify_email: true,
        email_verified: false,
      }),
    });
  }

  async function sendPasswordResetEmail(email) {
    if (!config.passwordResetClientId) return false;

    const response = await fetchImpl(`${auth0ApiBaseUrl(config.domain)}/dbconnections/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.passwordResetClientId,
        email,
        connection: config.connection,
      }),
    });
    const body = await jsonOrText(response);
    if (!response.ok) throw new Error(auth0ErrorMessage("Auth0 password reset API", response, body));
    return true;
  }

  return {
    isConfigured: isConfigured(config),
    async resolveOrCreateUser({ email, displayName }) {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return {
          externalSubject: existingUser.user_id,
          email: existingUser.email ?? email,
          displayName: existingUser.name ?? displayName ?? "",
          created: false,
          invitationSent: false,
        };
      }

      const createdUser = await createUser({ email, displayName });
      const invitationSent = await sendPasswordResetEmail(createdUser.email ?? email);
      return {
        externalSubject: createdUser.user_id,
        email: createdUser.email ?? email,
        displayName: createdUser.name ?? displayName ?? "",
        created: true,
        invitationSent,
      };
    },
  };
}
