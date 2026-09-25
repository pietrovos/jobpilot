import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit } from "@/lib/backend-limits";
import { createSession, getCurrentUser } from "@/lib/auth";
import {
  OAUTH_STATE_COOKIE,
  callbackUri,
  decodeStateCookie,
  exchangeCode,
  fetchProfile,
  providerConfig,
  statesMatch,
} from "@/lib/oauth";
import { linkOAuthAccount, resolveOAuthUser } from "@/lib/oauth-accounts";
import { adoptGuestWorkspace } from "@/lib/oauth-session";

export const dynamic = "force-dynamic";

const REASONS = { "no-email": "no-email", "email-taken": "email-taken", "link-taken": "link-taken" } as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const origin = request.nextUrl.origin;
  const cookieStore = await cookies();
  const { provider } = await params;

  // The provider reports a declined consent without a state parameter.
  if (request.nextUrl.searchParams.get("error")) {
    return failure(origin, cookieStore, "denied");
  }

  const stored = decodeStateCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!stored || stored.provider !== provider || !statesMatch(stored.state, request.nextUrl.searchParams.get("state"))) {
    return failure(origin, cookieStore, "state");
  }

  const config = providerConfig(stored.provider);
  const code = request.nextUrl.searchParams.get("code");
  if (!config || !code || !(await consumeRateLimit(`oauth-callback:${stored.provider}`, 120, 15 * 60 * 1000))) {
    return failure(origin, cookieStore, "failed");
  }

  let user;
  try {
    const token = await exchangeCode(config, code, callbackUri(origin, stored.provider), stored.verifier);
    const profile = await fetchProfile(stored.provider, token);

    if (stored.link) {
      const current = await getCurrentUser();
      if (!current || current.isGuest) return failure(origin, cookieStore, "failed", "/settings");
      const linked = await linkOAuthAccount(current.id, stored.provider, profile);
      if (!linked.ok) return failure(origin, cookieStore, REASONS[linked.reason], "/settings");
      return NextResponse.redirect(new URL("/settings?oauth=connected", origin));
    }

    const guest = await getCurrentUser();
    const resolution = await resolveOAuthUser(stored.provider, profile);
    if (!resolution.ok) return failure(origin, cookieStore, REASONS[resolution.reason]);

    if (guest?.isGuest && guest.id !== resolution.userId) {
      await adoptGuestWorkspace(guest.id, resolution.userId);
    }

    await createSession(resolution.userId);
    user = resolution.userId;
  } catch {
    return failure(origin, cookieStore, "failed");
  }

  if (!user) return failure(origin, cookieStore, "failed");
  return NextResponse.redirect(new URL(stored.next, origin));
}

function failure(origin: string, cookieStore: Awaited<ReturnType<typeof cookies>>, code: string, to = "/login") {
  cookieStore.delete(OAUTH_STATE_COOKIE);
  const destination = new URL(to, origin);
  destination.searchParams.set("oauth", code);
  return NextResponse.redirect(destination);
}
