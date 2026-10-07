import { LoginForm } from "./login-form";
import { AuthShell } from "../auth/auth-shell";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <AuthShell
      kicker="Student Portal Login"
      subtitle="Sign in with any email account you used to create your student profile."
      title="Welcome Back"
    >
      <LoginForm next={params.next} />
    </AuthShell>
  );
}
