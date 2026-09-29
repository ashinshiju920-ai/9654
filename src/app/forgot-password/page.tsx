import { AuthShell } from "../auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      kicker="Password Help"
      subtitle="Enter your email and Supabase will send a secure reset link"
      title="Reset Access"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
