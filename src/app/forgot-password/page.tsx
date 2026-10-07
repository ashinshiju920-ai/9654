import { AuthShell } from "../auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      kicker="Password Setup"
      subtitle="Enter your account email and we'll send a secure link to create or reset your portal password."
      title="Set Up Your Password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
