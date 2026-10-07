import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { getResendStatus, sendTransactionalEmail } from "@/lib/email/resend";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  const status = await getResendStatus();
  return NextResponse.json({
    ...status,
    isSandboxFrom: status.fromEmail.includes("resend.dev"),
    note: status.fromEmail.includes("resend.dev")
      ? "Using Resend test domain (onboarding@resend.dev). Resend only delivers emails to the account owner's email address. To send to students, configure a verified domain at https://resend.com/domains."
      : "Using custom sender domain.",
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.errorResponse) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to } = (body || {}) as { to?: string };
  if (!to || typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "Valid 'to' recipient email is required." }, { status: 400 });
  }

  try {
    const result = await sendTransactionalEmail({
      to: to.trim().toLowerCase(),
      subject: "Aylem Learning - Resend Test Email",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d9488; margin-top: 0;">Resend Email Test Successful</h2>
          <p>This is a test email sent from your Aylem Learning portal to verify transactional email delivery.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #64748b; font-size: 13px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `Resend Email Test Successful\n\nThis is a test email sent from your Aylem Learning portal to verify transactional email delivery.\n\nTimestamp: ${new Date().toISOString()}`,
    });

    if (result.status === "skipped") {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          reason: result.reason,
          error: "RESEND_API_KEY is not configured in this environment.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      id: result.id,
      message: `Test email sent successfully to ${to}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
