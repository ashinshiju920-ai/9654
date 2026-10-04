"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui";
import { safeAppPath } from "@/lib/auth/account-lifecycle";

export function SignupForm({ next: propNext }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = propNext || searchParams.get("next");
  const targetDestination = safeAppPath(nextParam, "/dashboard");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: name,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Failed to create account.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setMessage("Account created successfully! Redirecting...");

      setTimeout(() => {
        router.replace(targetDestination);
        router.refresh();
      }, 500);
    } catch {
      setMessage("An error occurred connecting to the server. Please try again.");
      setIsLoading(false);
    }
  }

  const loginHref =
    targetDestination !== "/dashboard"
      ? `/login?next=${encodeURIComponent(targetDestination)}`
      : "/login";

  return (
    <form className="login-form" onSubmit={handleSignup}>
      <label className="login-field">
        <span>Name</span>
        <span className="login-field__control">
          <User size={17} aria-hidden="true" />
          <input
            autoComplete="name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            required
            type="text"
            value={name}
          />
        </span>
      </label>

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
            autoComplete="new-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (minimum 8 characters)"
            required
            type="password"
            value={password}
          />
        </span>
      </label>

      <label className="login-field">
        <span>Confirm password</span>
        <span className="login-field__control">
          <Lock size={17} aria-hidden="true" />
          <input
            autoComplete="new-password"
            minLength={8}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            required
            type="password"
            value={confirmPassword}
          />
        </span>
      </label>

      {message ? (
        <p className={isSuccess ? "login-form__success" : "login-form__error"} role="alert">
          {message}
        </p>
      ) : null}

      <Button disabled={isLoading} type="submit">
        {isLoading ? "Creating account..." : "Create Account"}
      </Button>

      <p className="login-form__support">
        Already have an account? <Link href={loginHref}>Log in.</Link>
      </p>
    </form>
  );
}
