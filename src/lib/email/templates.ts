type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

const brand = {
  name: "Aylem Learning",
  navy: "#0b1f3a",
  teal: "#0f766e",
  muted: "#64748b",
  border: "#dbe4ee",
  background: "#f6f9fc",
};

type ActionEmailInput = {
  fullName?: string | null;
  actionUrl: string;
};

export function verifyEmailTemplate(input: ActionEmailInput): EmailTemplate {
  return actionTemplate({
    title: "Verify your Aylem Learning email",
    intro: `Confirm this email address to secure your Aylem Learning Student Portal account${nameSuffix(input.fullName)}.`,
    buttonText: "Verify email",
    actionUrl: input.actionUrl,
    expires: "This verification link expires in 24 hours.",
  });
}

export function resetPasswordTemplate(input: ActionEmailInput): EmailTemplate {
  return actionTemplate({
    title: "Reset your Aylem Learning password",
    intro:
      "We received a request to reset your Aylem Learning Student Portal password. Use the secure link below to choose a new password.",
    buttonText: "Reset password",
    actionUrl: input.actionUrl,
    expires: "This password reset link expires in 1 hour.",
  });
}

export function passwordChangedTemplate(input: {
  fullName?: string | null;
}): EmailTemplate {
  const greeting = input.fullName ? `Hi ${input.fullName},` : "Hi,";
  const subject = "Your Aylem Learning password was changed";
  const text = `${greeting}

Your Aylem Learning Student Portal password was changed successfully.

If you did not make this change, contact Aylem Learning support immediately.`;

  return {
    subject,
    text,
    html: baseHtml({
      title: subject,
      content: `
        <p>${escapeHtml(greeting)}</p>
        <p>Your Aylem Learning Student Portal password was changed successfully.</p>
        <p class="muted">If you did not make this change, contact Aylem Learning support immediately.</p>
      `,
    }),
  };
}

function actionTemplate(input: {
  title: string;
  intro: string;
  buttonText: string;
  actionUrl: string;
  expires: string;
}): EmailTemplate {
  const text = `${input.title}

${input.intro}

${input.buttonText}: ${input.actionUrl}

${input.expires}

If you did not request this, you can safely ignore this email.`;

  return {
    subject: input.title,
    text,
    html: baseHtml({
      title: input.title,
      content: `
        <p>${escapeHtml(input.intro)}</p>
        <p class="button-row">
          <a class="button" href="${escapeAttribute(input.actionUrl)}">${escapeHtml(input.buttonText)}</a>
        </p>
        <p class="muted">${escapeHtml(input.expires)}</p>
        <p class="muted">If you did not request this, you can safely ignore this email.</p>
      `,
    }),
  };
}

function baseHtml(input: { title: string; content: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
    <style>
      body { margin: 0; background: ${brand.background}; color: ${brand.navy}; font-family: Arial, sans-serif; }
      .wrap { width: 100%; padding: 28px 12px; }
      .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid ${brand.border}; border-radius: 8px; overflow: hidden; }
      .header { padding: 24px 28px; background: ${brand.navy}; color: #ffffff; }
      .brand { margin: 0; font-size: 18px; font-weight: 700; }
      .body { padding: 28px; font-size: 16px; line-height: 1.6; }
      h1 { margin: 0 0 18px; font-size: 24px; line-height: 1.25; }
      p { margin: 0 0 16px; }
      .muted { color: ${brand.muted}; font-size: 14px; }
      .button-row { margin: 24px 0; }
      .button { display: inline-block; background: ${brand.teal}; color: #ffffff !important; text-decoration: none; padding: 12px 18px; border-radius: 6px; font-weight: 700; }
      .footer { padding: 18px 28px; border-top: 1px solid ${brand.border}; color: ${brand.muted}; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="header"><p class="brand">${brand.name}</p></div>
        <div class="body">
          <h1>${escapeHtml(input.title)}</h1>
          ${input.content}
        </div>
        <div class="footer">Aylem Learning transactional account notification.</div>
      </div>
    </div>
  </body>
</html>`;
}

function nameSuffix(name?: string | null): string {
  return name ? `, ${name}` : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
