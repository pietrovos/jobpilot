import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OAUTH_PROVIDER_INFO, enabledProviders, isOAuthProvider } from "@/lib/oauth";
import { changePassword, deleteAccount, disconnectProvider, revokeOtherSessions } from "./actions";
import { SubmitButton } from "../ui/submit-button";

const messages: Record<string, string> = {
  limited: "Too many attempts. Wait 15 minutes before trying again.",
  invalid: "Your current password was not accepted.",
  password: "Use at least 8 characters and at most 72 UTF-8 bytes. The new passwords must match.",
  passwordless: "Set a password below first, then use it to confirm this action.",
  confirmation: "Type DELETE to confirm account deletion.",
  changed: "Password changed. Other sessions have been revoked.",
  revoked: "Other sessions have been revoked.",
  connected: "Provider connected.",
  disconnected: "Provider disconnected.",
  "last-method": "Connect another sign-in method before removing this one.",
  provider: "That provider is not available.",
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  const params = await searchParams;
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, oauthAccounts: { orderBy: { createdAt: "asc" }, select: { provider: true } } },
  });
  const hasPassword = account.passwordHash !== null;
  const connected = account.oauthAccounts.map((item) => item.provider).filter(isOAuthProvider);
  const connectedSet = new Set(connected);
  const connectable = enabledProviders().filter((provider) => !connectedSet.has(provider));

  return <main id="main-content" className="site-shell min-h-screen px-4 py-8">
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/" className="text-sky-200">Back to applications</Link>
      <h1 className="text-3xl font-black">Account settings</h1>
      <p className="text-slate-300">{user.email}</p>
      {params.message && messages[params.message] ? <p role="status" className="border border-sky-300/30 p-4">{messages[params.message]}</p> : null}
      <section className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold">{hasPassword ? "Change password" : "Set a password"}</h2>
        <form action={changePassword} className="grid gap-4">
          {hasPassword ? <PasswordField name="currentPassword" label="Current password" /> : null}
          <PasswordField name="newPassword" label="New password" />
          <PasswordField name="confirmPassword" label="Confirm new password" />
          <p className="text-sm text-slate-400">
            At least 8 characters; at most 72 UTF-8 bytes. Other devices will be signed out.
            {hasPassword ? null : " Adding a password lets you log in without a provider."}
          </p>
          <SubmitButton className="border border-sky-300/40 px-4 py-3 text-sky-100">{hasPassword ? "Change password" : "Set password"}</SubmitButton>
        </form>
      </section>
      <section className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold">Connected accounts</h2>
        <ul className="space-y-2">
          {connected.map((provider) => (
            <li key={provider} className="flex items-center justify-between border border-white/10 px-4 py-3">
              <span className="text-sm font-bold">{OAUTH_PROVIDER_INFO[provider].label}</span>
              <form action={disconnectProvider}>
                <input type="hidden" name="provider" value={provider} />
                <SubmitButton className="border border-rose-400/25 px-3 py-2 text-sm text-rose-200">Disconnect</SubmitButton>
              </form>
            </li>
          ))}
          {connectable.map((provider) => (
            <li key={provider} className="flex items-center justify-between border border-white/10 px-4 py-3">
              <span className="text-sm font-bold">{OAUTH_PROVIDER_INFO[provider].label}</span>
              <Link href={`/api/auth/oauth/${provider}?link=1`} className="border border-sky-300/40 px-3 py-2 text-sm text-sky-100">Connect</Link>
            </li>
          ))}
        </ul>
        {!hasPassword ? <p className="text-sm text-slate-400">Keep at least one sign-in method connected.</p> : null}
      </section>
      <section className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold">Sessions</h2>
        <form action={revokeOtherSessions} className="grid gap-4">
          <PasswordField name="currentPassword" label="Current password to revoke sessions" />
          <SubmitButton className="border border-white/20 px-4 py-3">Sign out other devices</SubmitButton>
        </form>
      </section>
      <section className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold">Your data</h2>
        <p className="text-sm text-slate-400">The JSON export contains application records and file metadata, not document bytes. Download documents separately before deleting your account.</p>
        <a href="/settings/export" className="inline-block border border-white/20 px-4 py-3">Download metadata export</a>
        <p className="text-sm text-rose-200">Account deletion is permanent. Database records are deleted immediately; inaccessible file bytes are removed during scheduled maintenance. Backup retention is controlled by the deployment operator.</p>
        <form action={deleteAccount} className="grid gap-4">
          <PasswordField name="currentPassword" label="Current password to delete account" />
          <label className="grid gap-2">Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autoComplete="off" className="border border-white/20 bg-slate-900 p-3" /></label>
          <SubmitButton className="border border-rose-400/40 px-4 py-3 text-rose-200">Permanently delete account</SubmitButton>
        </form>
      </section>
    </div>
  </main>;
}

function PasswordField({ name, label }: { name: string; label: string }) {
  return <label className="grid gap-2">{label}<input name={name} type="password" required minLength={8} autoComplete={name === "currentPassword" ? "current-password" : "new-password"} className="border border-white/20 bg-slate-900 p-3" /></label>;
}
