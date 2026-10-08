"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui";
import { safeAppPath } from "@/lib/auth/account-lifecycle";

export function SignupForm({
  initialMode = "signup",
  next: propNext,
}: {
  initialMode?: "signup" | "signin";
  next?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = propNext || searchParams.get("next");
  const targetDestination = safeAppPath(nextParam, "/dashboard");

  const [mode, setMode] = useState<"signup" | "signin">(
    searchParams.get("mode") === "signin" ? "signin" : initialMode,
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingAccountDetected, setExistingAccountDetected] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSuccess(false);
    setExistingAccountDetected(false);

    if (mode === "signup") {
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
          if (response.status === 409 || data.error?.toLowerCase().includes("already exists")) {
            setExistingAccountDetected(true);
            setMessage("An account with this email already exists. Click below to sign in.");
          } else {
            setMessage(data.error || "Failed to create account.");
          }
          setIsLoading(false);
          return;
        }

        setIsSuccess(true);
        setMessage("Account created successfully. We sent a verification email. Redirecting...");

        setTimeout(() => {
          router.replace(targetDestination);
          router.refresh();
        }, 500);
      } catch {
        setMessage("An error occurred connecting to the server. Please try again.");
        setIsLoading(false);
      }
    } else {
      // Sign In mode
      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          setMessage(data.error || "Invalid email or password.");
          setIsLoading(false);
          return;
        }

        setIsSuccess(true);
        setMessage("Signed in successfully! Redirecting...");

        setTimeout(() => {
          router.replace(targetDestination);
          router.refresh();
        }, 500);
      } catch {
        setMessage("An error occurred connecting to the server. Please try again.");
        setIsLoading(false);
      }
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      setMessage("Enter your email address first.");
      setIsSuccess(false);
      return;
    }

    setIsResending(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: targetDestination }),
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setIsSuccess(false);
        setMessage(data.error || "Could not resend the verification email.");
        return;
      }

      setIsSuccess(true);
      setMessage(data.message || "Verification email sent. Check your inbox.");
    } catch {
      setIsSuccess(false);
      setMessage("An error occurred connecting to the server. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  const forgotPasswordHref =
    targetDestination !== "/dashboard"
      ? `/forgot-password?next=${encodeURIComponent(targetDestination)}`
      : "/forgot-password";

  return (
    <div className="login-form-container">
      {/* Mode Switcher Tabs */}
      <div
        role="tablist"
        aria-label="Account access options"
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "20px",
          background: "rgba(148, 163, 184, 0.12)",
          padding: "4px",
          borderRadius: "10px",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setMessage("");
            setExistingAccountDetected(false);
          }}
          style={{
            flex: 1,
            padding: "8px 14px",
            border: "none",
            borderRadius: "7px",
            fontSize: "14px",
            fontWeight: mode === "signup" ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.18s ease",
            background: mode === "signup" ? "#ffffff" : "transparent",
            color: mode === "signup" ? "#0f172a" : "#64748b",
            boxShadow:
              mode === "signup" ? "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          Create Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setMessage("");
            setExistingAccountDetected(false);
          }}
          style={{
            flex: 1,
            padding: "8px 14px",
            border: "none",
            borderRadius: "7px",
            fontSize: "14px",
            fontWeight: mode === "signin" ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.18s ease",
            background: mode === "signin" ? "#ffffff" : "transparent",
            color: mode === "signin" ? "#0f172a" : "#64748b",
            boxShadow:
              mode === "signin" ? "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          Sign In
        </button>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {mode === "signup" && (
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
        )}

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
          <small className="login-field__hint">
            {mode === "signup"
              ? "We will send course access & confirmations to this email."
              : "Use the email address registered with your account."}
          </small>
        </label>

        <label className="login-field">
          <span>{mode === "signup" ? "Create password" : "Password"}</span>
          <span className="login-field__control">
            <Lock size={17} aria-hidden="true" />
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
          </span>
          {mode === "signup" && <small className="login-field__hint">Minimum 8 characters.</small>}
        </label>

        {mode === "signup" && (
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
        )}

        {mode === "signin" && (
          <div className="login-form__assist login-form__assist--setup">
            <span>Forgot your password?</span>
            <Link href={forgotPasswordHref}>Reset password</Link>
          </div>
        )}

        {message ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p className={isSuccess ? "login-form__success" : "login-form__error"} role="alert">
              {message}
            </p>
            {existingAccountDetected && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                  setExistingAccountDetected(false);
                }}
                style={{
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  color: "#0d9488",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Switch to Sign In →
              </button>
            )}
          </div>
        ) : null}

        <Button disabled={isLoading} type="submit">
          {isLoading
            ? mode === "signup"
              ? "Creating account..."
              : "Signing in..."
            : mode === "signup"
              ? "Create Account"
              : "Sign In"}
        </Button>

        <p className="login-form__support">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                  padding: 0,
                }}
              >
                Sign in instead.
              </button>
            </>
          ) : (
            <>
              Need an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                  padding: 0,
                }}
              >
                Create one now.
              </button>
            </>
          )}
        </p>

        <p className="login-form__support">
          Need the verification email again?{" "}
          <button
            type="button"
            disabled={isResending || isLoading}
            onClick={handleResendVerification}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: isResending || isLoading ? "not-allowed" : "pointer",
              font: "inherit",
              opacity: isResending || isLoading ? 0.65 : 1,
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {isResending ? "Sending..." : "Resend verification"}
          </button>
        </p>
      </form>
    </div>
  );
}
