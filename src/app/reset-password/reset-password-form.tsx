"use client";

import { Key, Lock } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("token") || "";
    }
    return "";
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [password, setPassword] = useState("");

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
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

    if (!token.trim()) {
      setMessage("A password reset token is required. (Email delivery integration is pending).");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const data = (await response.json()) as { error?: string };
      setIsLoading(false);

      if (!response.ok) {
        setMessage(data.error || "Failed to update password.");
        return;
      }

      setIsSuccess(true);
      setMessage("Password updated successfully! Redirecting to login...");

      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch {
      setIsLoading(false);
      setMessage("An error occurred connecting to the server. Please try again.");
    }
  }

  return (
    <form className="login-form" onSubmit={handlePasswordUpdate}>
      {!token && (
        <label className="login-field">
          <span>Reset Token</span>
          <span className="login-field__control">
            <Key size={17} aria-hidden="true" />
            <input
              name="token"
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your reset token"
              required
              type="text"
              value={token}
            />
          </span>
        </label>
      )}

      <label className="login-field">
        <span>New password</span>
        <span className="login-field__control">
          <Lock size={17} aria-hidden="true" />
          <input
            autoComplete="new-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password (minimum 8 characters)"
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
        {isLoading ? "Updating..." : "Update Password"}
      </Button>

      <p className="login-form__support">
        Link expired? <Link href="/forgot-password">Request a new one.</Link>
      </p>
    </form>
  );
}
