import { AuthShell } from "../auth/auth-shell";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      kicker="Create Account"
      subtitle="Register for your Aylem Student Portal access"
      title="Join Aylem"
    >
      <SignupForm />
    </AuthShell>
  );
}
