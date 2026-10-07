"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState("");

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      setIsLoading(false);

      if (!response.ok) {
        setMessage(data.error || "An error occurred while requesting password reset.");
        return;
      }

      setIsSuccess(true);
      setMessage(data.message || "Password reset request recorded.");
    } catch {
      setIsLoading(false);
      setMessage("An error occurred connecting to the server. Please try again.");
    }
  }

  return (
    <form className="login-form" onSubmit={handleResetRequest}>
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

      {message ? (
        <p className={isSuccess ? "login-form__success" : "login-form__error"} role="alert">
          {message}
        </p>
      ) : null}

      <Button disabled={isLoading} type="submit">
        {isLoading ? "Sending..." : "Send Secure Link"}
      </Button>

      <p className="login-form__support">
        Remembered it? <Link href="/signup">Sign in or create account.</Link>
      </p>
    </form>
  );
}
