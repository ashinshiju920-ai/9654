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
      subtitle="Use your purchase email to log in, or set up your portal password if this is your first visit."
      title="Welcome Back"
    >
      <LoginForm next={params.next} />
    </AuthShell>
  );
}
