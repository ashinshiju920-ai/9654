import { AuthShell } from "../auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      kicker="Password Help"
      subtitle="Enter your email to request a secure password reset link"
      title="Reset Access"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
