import { redirect } from "next/navigation";
import { continueAsGuest, signIn } from "../actions";
import { AuthField, AuthShell, AuthSubmit, AuthSwitch, ProviderButtons, authMessage } from "../auth-ui";
import { getCurrentUser, isGuestUser } from "@/lib/auth";

type LoginProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginProps) {
  const user = await getCurrentUser();

  if (user && !isGuestUser(user)) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const email = single(params.email);

  return (
    <AuthShell
      title="Log in"
      subtitle="Enter your account details to open your dashboard."
      message={authMessage(params.auth ?? params.oauth)}
    >
      <ProviderButtons />
      <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-600">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <form action={signIn} className="grid gap-4">
        <AuthField name="email" label="Email" type="email" placeholder="you@example.com" defaultValue={email} />
        <AuthField name="password" label="Password" type="password" autoComplete="current-password" placeholder="Your password" />
        <AuthSubmit>Log in</AuthSubmit>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-600">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <form action={continueAsGuest}>
        <button className="w-full border border-cyan-300/25 bg-slate-950/70 px-5 py-3 font-black text-cyan-200 transition hover:border-cyan-200/55 hover:bg-cyan-400/10 hover:shadow-[0_0_24px_rgb(34_211_238/0.14)]">
          Continue as guest
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-400">Guest sessions expire after 24 hours. Signing out deletes guest data. Create an account to keep your work.</p>
      <AuthSwitch href="/signup">No account? Sign up</AuthSwitch>
    </AuthShell>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
