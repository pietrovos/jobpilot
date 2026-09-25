import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const OAUTH_PROVIDERS = ["google", "github", "linkedin"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export type OAuthProviderInfo = { label: string; trustedEmail: boolean };

export const OAUTH_PROVIDER_INFO: Record<OAuthProvider, OAuthProviderInfo> = {
  google: { label: "Google", trustedEmail: true },
  github: { label: "GitHub", trustedEmail: true },
  // LinkedIn OIDC does not assert email_verified, so its address is treated as
  // untrusted: it can create an account but never link onto an existing one.
  linkedin: { label: "LinkedIn", trustedEmail: false },
};

type ProviderEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
};

const PROVIDER_ENDPOINTS: Record<OAuthProvider, ProviderEndpoints> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
  },
  linkedin: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile email",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  },
};

// Prefixed endpoint overrides exist for tests and for deployments that must
// route through a proxy; production leaves them unset.
function endpointOverride(provider: OAuthProvider, kind: string) {
  return process.env[`${provider.toUpperCase()}_${kind}_URL`];
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

// Only same-site relative paths are ever used as post-login destinations.
export function safeNextPath(value: string | null | undefined) {
  return value === "/documents" ? value : "/";
}

export const OAUTH_STATE_COOKIE = "jobpilot_oauth";
export const OAUTH_STATE_MINUTES = 10;

export const OAUTH_LINK_CODE = "link-required";

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
};

export function providerConfig(provider: OAuthProvider): OAuthConfig | null {
  const endpoints = PROVIDER_ENDPOINTS[provider];
  const clientId = process.env[endpoints.clientIdEnv];
  const clientSecret = process.env[endpoints.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeUrl: endpointOverride(provider, "AUTHORIZE") ?? endpoints.authorizeUrl,
    tokenUrl: endpointOverride(provider, "TOKEN") ?? endpoints.tokenUrl,
    scope: endpoints.scope,
  };
}

export function enabledProviders(): OAuthProvider[] {
  // Development always lists every provider so the buttons stay visible while
  // building the UI; production only lists providers that actually work.
  if (process.env.NODE_ENV !== "production") return [...OAUTH_PROVIDERS];
  return OAUTH_PROVIDERS.filter((provider) => providerConfig(provider) !== null);
}

export function callbackUri(origin: string, provider: OAuthProvider) {
  return `${origin.endsWith("/") ? origin : `${origin}/`}api/auth/oauth/${provider}/callback`;
}

const ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  state: "That sign-in attempt expired. Please try again.",
  "no-email": "That provider did not share an email address we can use.",
  "email-taken": "That email already has an account with a password. Log in with it, then connect this provider from Account settings.",
  "link-taken": "That provider is already connected to another account.",
  unconfigured: "That sign-in provider is not configured on this server yet.",
  failed: "Could not sign in with that provider. Please try again.",
};

export function oauthErrorMessage(code: string | undefined) {
  if (!code) return undefined;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.failed;
}

export function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export type OAuthState = {
  provider: OAuthProvider;
  state: string;
  verifier: string;
  next: string;
  link: boolean;
};

export function encodeStateCookie(value: OAuthState) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeStateCookie(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthState>;
    if (!parsed || typeof parsed !== "object") return null;
    const provider = parsed.provider;
    if (typeof provider !== "string" || !isOAuthProvider(provider)) return null;
    if (typeof parsed.state !== "string" || parsed.state.length < 32) return null;
    if (typeof parsed.verifier !== "string" || parsed.verifier.length < 32) return null;
    return { provider, state: parsed.state, verifier: parsed.verifier, next: safeNextPath(parsed.next), link: Boolean(parsed.link) };
  } catch {
    return null;
  }
}

export function statesMatch(expected: string, received: string | null) {
  if (!received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export type OAuthProfile = {
  providerAccountId: string;
  email: string | null;
  name: string;
};

type TokenResponse = { access_token?: unknown };

export async function exchangeCode(config: OAuthConfig, code: string, redirectUri: string, verifier: string): Promise<string> {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("OAuth token exchange failed");
  const payload = (await response.json()) as TokenResponse;
  if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
    throw new Error("OAuth token response missing access_token");
  }
  return payload.access_token;
}

async function authorizedJson(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "JobPilot" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("OAuth profile request failed");
  return await response.json();
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function fetchGoogleProfile(token: string): Promise<OAuthProfile> {
  const profile = record(await authorizedJson(endpointOverride("google", "PROFILE") ?? "https://openidconnect.googleapis.com/v1/userinfo", token));
  const sub = stringField(profile, "sub");
  if (!sub) throw new Error("Google profile missing sub");
  const email = stringField(profile, "email");
  // Google only proves ownership here when it says the address is verified.
  const verified = profile?.email_verified === true;
  return {
    providerAccountId: sub,
    email: verified && email ? email.toLowerCase() : null,
    name: stringField(profile, "name") ?? email?.split("@")[0] ?? "Pilot",
  };
}

export async function fetchGitHubProfile(token: string): Promise<OAuthProfile> {
  const profile = record(await authorizedJson(endpointOverride("github", "PROFILE") ?? "https://api.github.com/user", token));
  const id = profile?.id;
  if (typeof id !== "number") throw new Error("GitHub profile missing id");

  let email = stringField(profile, "email");
  if (!email) {
    // The public profile hides private addresses; ask for the verified primary one.
    const payload = await authorizedJson(endpointOverride("github", "EMAILS") ?? "https://api.github.com/user/emails", token);
    const candidates = (Array.isArray(payload) ? payload : []).map(record).filter((item): item is Record<string, unknown> => item !== null);
    const verified = candidates.filter((item) => item.verified === true);
    const primary = verified.find((item) => item.primary === true) ?? verified[0];
    email = stringField(primary ?? null, "email");
  }

  return {
    providerAccountId: String(id),
    email: email?.toLowerCase() ?? null,
    name: stringField(profile, "name") ?? stringField(profile, "login") ?? "Pilot",
  };
}

export async function fetchLinkedInProfile(token: string): Promise<OAuthProfile> {
  const profile = record(await authorizedJson(endpointOverride("linkedin", "PROFILE") ?? "https://api.linkedin.com/v2/userinfo", token));
  const sub = stringField(profile, "sub");
  if (!sub) throw new Error("LinkedIn profile missing sub");
  return {
    providerAccountId: sub,
    email: stringField(profile, "email")?.toLowerCase() ?? null,
    name: stringField(profile, "name") ?? "Pilot",
  };
}

export function fetchProfile(provider: OAuthProvider, token: string): Promise<OAuthProfile> {
  if (provider === "google") return fetchGoogleProfile(token);
  if (provider === "github") return fetchGitHubProfile(token);
  return fetchLinkedInProfile(token);
}
