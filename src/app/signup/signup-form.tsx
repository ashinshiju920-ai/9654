"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { getAuthRedirectUrl, toAuthMessage } from "../auth/auth-utils";

export function SignupForm() {
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

    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: getAuthRedirectUrl("/dashboard"),
      },
    });
    setIsLoading(false);

    if (error) {
      setMessage(toAuthMessage(error.message));
      return;
    }

    setIsSuccess(true);
    setMessage(
      data.session
        ? "Account created. Redirecting you to the dashboard..."
        : "Check your email to verify your account, then return to log in.",
    );

    if (data.session) {
      window.location.replace("/dashboard");
    }
  }

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
            minLength={6}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
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
            minLength={6}
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
        Already have an account? <Link href="/login">Log in.</Link>
      </p>
    </form>
  );
}
