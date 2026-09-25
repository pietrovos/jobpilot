import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit } from "@/lib/backend-limits";
import { getCurrentUser } from "@/lib/auth";
import {
  callbackUri,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MINUTES,
  encodeStateCookie,
  isOAuthProvider,
  pkceChallenge,
  providerConfig,
  randomUrlSafe,
  safeNextPath,
  type OAuthState,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = request.nextUrl.origin;

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL("/login?oauth=failed", origin));
  }

  const config = providerConfig(provider);
  if (!config) {
    // Development renders every provider so the UI stays visible, but only a
    // configured one can start a real authorization request.
    return NextResponse.redirect(new URL("/login?oauth=unconfigured", origin));
  }
  if (!(await consumeRateLimit(`oauth:${provider}`, 60, 15 * 60 * 1000))) {
    return NextResponse.redirect(new URL("/login?oauth=failed", origin));
  }

  // Linking only makes sense for a signed-in, non-guest account and must start
  // from Account settings so the intent is explicit.
  const link = request.nextUrl.searchParams.get("link") === "1";
  const user = await getCurrentUser();
  if (link) {
    if (!user || user.isGuest) return NextResponse.redirect(new URL("/login", origin));
  } else if (user && !user.isGuest) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const state = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const payload: OAuthState = { provider, state, verifier, next, link };
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, encodeStateCookie(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_MINUTES * 60,
    path: "/",
  });

  const authorize = new URL(config.authorizeUrl);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", callbackUri(origin, provider));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", config.scope);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  // A chooser avoids silently reusing whichever account is already active.
  authorize.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authorize);
}
