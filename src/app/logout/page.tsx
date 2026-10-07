"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Loader } from "@/components/ui";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function signOut() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.error("Error during sign out:", error);
      } finally {
        router.replace("/courses");
        router.refresh();
      }
    }

    void signOut();
  }, [router]);

  return (
    <div className="page">
      <section className="page-header">
        <div>
          <p className="page-kicker">Logout</p>
          <h1 className="page-title">Signing out</h1>
          <p className="page-subtitle">Clearing your Aylem Student Portal session.</p>
        </div>
        <Loader label="Signing out" />
      </section>
    </div>
  );
}
