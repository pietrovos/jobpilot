import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requestPasswordReset } from "@/app/actions/password-reset";
import { AuthField, AuthShell, AuthSubmit, AuthSwitch, authMessage } from "../auth-ui";
import { passwordResetEnabled } from "@/lib/password-reset";

type ForgotPasswordProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordProps) {
  // Mail settings are read at request time, not baked in at build time.
  await connection();
  if (!passwordResetEnabled()) notFound();
  const params = (await searchParams) ?? {};

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your account email and we will send you a link to choose a new password."
      message={authMessage(params.auth)}
    >
      <form action={requestPasswordReset} className="grid gap-4">
        <AuthField name="email" label="Email" type="email" placeholder="you@example.com" />
        <AuthSubmit>Send reset link</AuthSubmit>
      </form>
      <AuthSwitch href="/login">Back to log in</AuthSwitch>
    </AuthShell>
  );
}
