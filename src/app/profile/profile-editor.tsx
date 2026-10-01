"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

type ProfileEditorProps = {
  initialEmail: string;
  initialFullName: string | null;
  role: string;
  accountStatus: string;
};

export function ProfileEditor({
  initialEmail,
  initialFullName,
  role,
  accountStatus,
}: ProfileEditorProps) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });

      const data = (await res.json()) as { error?: string; profile?: unknown };
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setStatusMessage({ type: "success", text: "Profile updated successfully." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Error connecting to server. Please try again." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="profile-form">
      <div className="stat-grid">
        <Input
          label="Full name"
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input disabled label="Email" value={initialEmail} />
        <Input disabled label="Role" value={role} />
        <Input disabled label="Account status" value={accountStatus} />
      </div>

      {statusMessage && (
        <p
          className={`profile-status ${statusMessage.type === "success" ? "text-success" : "login-form__error"}`}
          style={{ marginTop: "1rem" }}
        >
          {statusMessage.text}
        </p>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <Button disabled={isSaving} type="submit">
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
