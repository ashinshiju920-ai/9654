"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { getAuthRedirectUrl, toAuthMessage } from "../auth/auth-utils";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!hasSupabaseConfig()) {
      setErrorMessage("Supabase environment variables are not configured yet.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (error) {
      setErrorMessage(toAuthMessage(error.message));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setErrorMessage("");

    if (!hasSupabaseConfig()) {
      setErrorMessage("Supabase environment variables are not configured yet.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl("/dashboard"),
      },
    });

    if (error) {
      setErrorMessage(toAuthMessage(error.message));
    }
  }

  return (
    <form className="login-form" onSubmit={handleEmailLogin}>
      <label className="login-field">
        <span>Email address</span>
        <span className="login-field__control">
          <Mail size={17} aria-hidden="true" />
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            required
            type="email"
            value={email}
          />
        </span>
      </label>

      <label className="login-field">
        <span>Password</span>
        <span className="login-field__control">
          <Lock size={17} aria-hidden="true" />
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
        </span>
      </label>

      <Link className="login-form__forgot" href="/forgot-password">
        Forgot password?
      </Link>

      {errorMessage ? (
        <p className="login-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={isLoading} type="submit">
        {isLoading ? "Logging in..." : "Log In"}
      </Button>

      <div className="login-divider">
        <span>or</span>
      </div>

      <Button onClick={handleGoogleLogin} type="button" variant="secondary">
        <span className="google-mark" aria-hidden="true">
          G
        </span>
        Continue with Google
      </Button>

      <p className="login-form__support">
        Don&apos;t have an account? <Link href="/signup">Create account.</Link>
      </p>
    </form>
  );
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
