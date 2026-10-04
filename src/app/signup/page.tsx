import { AuthShell } from "../auth/auth-shell";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return (
    <AuthShell
      kicker="Create Account"
      subtitle="Register for your Aylem Student Portal access"
      title="Join Aylem"
    >
      <SignupForm next={params.next} />
    </AuthShell>
  );
}
