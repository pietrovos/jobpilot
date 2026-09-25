import Link from "next/link";
import { enabledProviders, oauthErrorMessage, OAUTH_PROVIDER_INFO } from "@/lib/oauth";
import { ProviderMark } from "./provider-marks";
import { SubmitButton } from "./ui/submit-button";

export function AuthShell({
  title,
  subtitle,
  message,
  children,
}: {
  title: string;
  subtitle: string;
  message?: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="site-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-md place-items-center">
        <section className="auth-card w-full border p-6 shadow-2xl">
          <p className="site-brand text-sm font-bold uppercase tracking-[0.35em]">JobPilot</p>
          <h1 className="mt-6 text-4xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-400">{subtitle}</p>
          {message ? (
            <div role="alert" className="mt-5 border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-200">
              {message}
            </div>
          ) : null}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-300">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete ?? (name === "email" ? "email" : name === "name" ? "name" : undefined)}
        minLength={type === "password" ? 8 : undefined}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="border border-white/10 bg-slate-900 px-4 py-3 font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
      />
    </label>
  );
}

export function AuthSubmit({ children }: { children: React.ReactNode }) {
  return (
    <SubmitButton className="mt-5 w-full bg-sky-500 px-5 py-3 font-black text-slate-950 transition hover:bg-sky-300 disabled:opacity-60">
      {children}
    </SubmitButton>
  );
}

export function AuthSwitch({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="mt-5 text-center text-sm font-semibold text-slate-400">
      <Link className="text-sky-300 hover:text-sky-200 hover:underline" href={href}>
        {children}
      </Link>
    </p>
  );
}

export function authMessage(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  if (code === "invalid-credentials") return "Email or password is incorrect.";
  if (code === "rate-limited") return "Too many attempts. Please wait before trying again.";

  if (code === "email-taken") return "That email already has an account.";
  if (code === "password-invalid") return "Password is incorrect.";
  if (code === "email-not-found") return "There is no account under that email.";
   if (code === "signup-invalid") return "Use a valid name, email, and password of at least 8 characters and at most 72 UTF-8 bytes.";
  if (code === "required") return "Log in before opening your dashboard.";

  return oauthErrorMessage(code);
}

// Renders the enabled providers, or nothing when the deployment has no OAuth
// credentials configured. Icon-only buttons carry an accessible name.
export function ProviderButtons({ next }: { next?: string }) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
      {providers.map((provider) => (
        <a
          key={provider}
          href={`/api/auth/oauth/${provider}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          aria-label={`Continue with ${OAUTH_PROVIDER_INFO[provider].label}`}
          title={`Continue with ${OAUTH_PROVIDER_INFO[provider].label}`}
          className="flex items-center justify-center border border-white/15 bg-slate-950/70 px-5 py-3 text-slate-100 transition hover:border-sky-300/45 hover:bg-sky-400/10"
        >
          <ProviderMark provider={provider} />
        </a>
      ))}
    </div>
  );
}
