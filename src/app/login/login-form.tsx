"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(data.error || "Invalid email or password.");
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("An error occurred connecting to the server. Please try again.");
      setIsLoading(false);
    }
  }

  function handleGoogleLogin() {
    setErrorMessage("Google login is currently disabled. Please log in with your email and password.");
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
