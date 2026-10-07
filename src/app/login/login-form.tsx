"use client";

import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui";
import { safeAppPath } from "@/lib/auth/account-lifecycle";

export function LoginForm({ next: propNext }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = propNext || searchParams.get("next");
  const targetDestination = safeAppPath(nextParam, "/dashboard");

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

      router.replace(targetDestination);
      router.refresh();
    } catch {
      setErrorMessage("An error occurred connecting to the server. Please try again.");
      setIsLoading(false);
    }
  }

  const forgotPasswordHref =
    targetDestination !== "/dashboard"
      ? `/forgot-password?next=${encodeURIComponent(targetDestination)}`
      : "/forgot-password";

  const signupHref =
    targetDestination !== "/dashboard"
      ? `/signup?next=${encodeURIComponent(targetDestination)}`
      : "/signup";

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
        <small className="login-field__hint">Use the email address for your student account.</small>
      </label>

      <label className="login-field">
        <span>Portal password</span>
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

      <div className="login-form__assist login-form__assist--setup">
        <span>Need a new password? We can send a secure reset link to your email.</span>
        <Link href={forgotPasswordHref}>Reset password</Link>
      </div>

      {errorMessage ? (
        <p className="login-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <Button disabled={isLoading} type="submit">
        {isLoading ? "Logging in..." : "Log In"}
      </Button>

      <p className="login-form__support">
        Don&apos;t have an account yet? <Link href={signupHref}>Create an account.</Link>
      </p>
    </form>
  );
}
