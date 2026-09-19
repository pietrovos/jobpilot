import { redirect } from "next/navigation";
import { signUp } from "../actions";
import { AuthField, AuthShell, AuthSubmit, AuthSwitch, authMessage } from "../auth-ui";
import { getCurrentUser, isGuestUser } from "@/lib/auth";

type SignupProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: SignupProps) {
  const user = await getCurrentUser();

  if (user && !isGuestUser(user)) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};

  return (
    <AuthShell
      title="Create account"
      subtitle={isGuestUser(user) ? "Create an account to keep the applications from this guest session." : "Set up JobPilot before tracking your applications."}
      message={authMessage(params.auth)}
    >
      <form action={signUp} className="grid gap-4">
        <AuthField name="name" label="Name" placeholder="Ada Lovelace" />
        <AuthField name="email" label="Email" type="email" placeholder="you@example.com" />
        <AuthField name="password" label="Password" type="password" placeholder="At least 8 characters" />
        <AuthSubmit>Create account</AuthSubmit>
      </form>
      <AuthSwitch href="/login">Already have an account? Log in</AuthSwitch>
    </AuthShell>
  );
}
