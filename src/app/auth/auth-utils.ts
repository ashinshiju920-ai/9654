export function getAuthRedirectUrl(path: string) {
  const origin = window.location.origin;
  return `${origin}/auth/callback?next=${encodeURIComponent(path)}`;
}

export function toAuthMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) {
    return "Please verify your email before logging in.";
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account already exists for this email.";
  }

  if (normalized.includes("invalid") && normalized.includes("email")) {
    return "Please enter a valid email address.";
  }

  if (normalized.includes("expired") || normalized.includes("invalid token")) {
    return "This authentication link is expired or invalid. Please request a new one.";
  }

  if (normalized.includes("fetch") || normalized.includes("network")) {
    return "We could not reach the authentication service. Please try again.";
  }

  return message || "Authentication failed. Please try again.";
}
