import { resetPassword } from "@/app/actions/password-reset";
import { AuthField, AuthShell, AuthSubmit, AuthSwitch, authMessage } from "../auth-ui";
import { findPasswordResetUser } from "@/lib/password-reset";

type ResetPasswordProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordProps) {
  const params = (await searchParams) ?? {};
  const token = single(params.token);
  const valid = Boolean(await findPasswordResetUser(token));

  if (!valid) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid, already used, or older than 30 minutes.">
        <AuthSwitch href="/forgot-password">Request a new link</AuthSwitch>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Saving it signs out every device that is logged in to this account."
      message={authMessage(params.auth)}
    >
      <form action={resetPassword} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <AuthField name="password" label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" />
        <AuthField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" placeholder="Repeat the new password" />
        <AuthSubmit>Save password</AuthSubmit>
      </form>
    </AuthShell>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
