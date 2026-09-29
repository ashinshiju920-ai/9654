"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { getAuthRedirectUrl, toAuthMessage } from "../auth/auth-utils";

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

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("/reset-password"),
    });
    setIsLoading(false);

    if (error) {
      setMessage(toAuthMessage(error.message));
      return;
    }

    setIsSuccess(true);
    setMessage("Check your email for the password reset link.");
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
      </label>

      {message ? (
        <p className={isSuccess ? "login-form__success" : "login-form__error"} role="alert">
          {message}
        </p>
      ) : null}

      <Button disabled={isLoading} type="submit">
        {isLoading ? "Sending..." : "Send Reset Link"}
      </Button>

      <p className="login-form__support">
        Remembered it? <Link href="/login">Log in.</Link>
      </p>
    </form>
  );
}
