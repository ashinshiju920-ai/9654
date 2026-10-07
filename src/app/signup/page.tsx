import { AuthShell } from "../auth/auth-shell";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; mode?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const isSignIn = params.mode === "signin";

  return (
    <AuthShell
      kicker={isSignIn ? "Welcome Back" : "Student Portal"}
      subtitle={
        isSignIn
          ? "Sign in to access your course materials and practice exams"
          : "Create an account or sign in to access your Aylem portal"
      }
      title="Aylem Learning"
    >
      <SignupForm initialMode={isSignIn ? "signin" : "signup"} next={params.next} />
    </AuthShell>
  );
}
