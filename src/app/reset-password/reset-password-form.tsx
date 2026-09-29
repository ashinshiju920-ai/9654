"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { toAuthMessage } from "../auth/auth-utils";

export function ResetPasswordForm() {
  const router = useRouter();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      setMessage(toAuthMessage(error.message));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handlePasswordUpdate}>
      <label className="login-field">
        <span>New password</span>
        <span className="login-field__control">
          <Lock size={17} aria-hidden="true" />
          <input
            autoComplete="new-password"
            minLength={6}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
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
        <p className="login-form__error" role="alert">
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
