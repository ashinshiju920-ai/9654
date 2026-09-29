import { LoginForm } from "./login-form";
import { AuthShell } from "../auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      kicker="Student Portal Login"
      subtitle="Log in to your Aylem Student Portal"
      title="Welcome Back"
    >
      <LoginForm />
    </AuthShell>
  );
}
