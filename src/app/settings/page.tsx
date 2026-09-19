import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { changePassword, deleteAccount, revokeOtherSessions } from "./actions";
import { SubmitButton } from "../ui/submit-button";

const messages: Record<string, string> = {
  limited: "Too many attempts. Wait 15 minutes before trying again.",
  invalid: "Your current password was not accepted.",
  password: "Use at least 8 characters and at most 72 UTF-8 bytes. The new passwords must match.",
  confirmation: "Type DELETE to confirm account deletion.",
  changed: "Password changed. Other sessions have been revoked.",
  revoked: "Other sessions have been revoked.",
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const user = await requireUser();
  if (user.isGuest) redirect("/signup");
  const params = await searchParams;
  return <main id="main-content" className="site-shell min-h-screen px-4 py-8">
    <div className="mx-auto max-w-2xl space-y-8">
      <Link href="/" className="text-sky-200">Back to applications</Link>
      <h1 className="text-3xl font-black">Account settings</h1>
      <p className="text-slate-300">{user.email}</p>
      {params.message && messages[params.message] ? <p role="status" className="border border-sky-300/30 p-4">{messages[params.message]}</p> : null}
      <section className="space-y-4 border-t border-white/10 pt-6">
        <h2 className="text-xl font-bold">Change password</h2>
        <form action={changePassword} className="grid gap-4">
          <PasswordField name="currentPassword" label="Current password" />
          <PasswordField name="newPassword" label="New password" />
          <PasswordField name="confirmPassword" label="Confirm new password" />
          <p className="text-sm text-slate-400">At least 8 characters; at most 72 UTF-8 bytes. Other devices will be signed out.</p>
          <SubmitButton className="border border-sky-300/40 px-4 py-3 text-sky-100">Change password</SubmitButton>
        </form>
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
