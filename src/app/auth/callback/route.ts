import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const redirectUrl = new URL("/login", requestUrl.origin);
      redirectUrl.searchParams.set("error", "This authentication link is expired or invalid.");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
