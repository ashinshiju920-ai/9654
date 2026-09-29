import { AuthShell } from "../auth/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      kicker="New Password"
      subtitle="Choose a new password for your Aylem Student Portal account"
      title="Update Password"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
