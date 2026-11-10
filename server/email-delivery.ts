import { exposeDevCode, env } from "./config";
import { HttpError } from "./http";

export async function sendSignInEmail(input: {
  to: string;
  code: string;
  link: string;
}): Promise<void> {
  if (exposeDevCode()) {
    console.info("Dev sign-in code issued");
    return;
  }

  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) {
    throw new HttpError(503, "Email sending is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Your PAN Parrot sign-in code",
      text: [
        `Your PAN Parrot sign-in code is ${input.code}.`,
        "It expires in 10 minutes.",
        "",
        "You can also open this link and press the confirm button:",
        input.link,
        "",
        "If you did not request this, ignore the email.",
        "PAN Parrot is an unofficial personal tool, not a Palo Alto Networks service.",
        "Do not send secrets or customer data to it.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Email provider rejected the sign-in message", response.status);
    throw new HttpError(502, "Could not send the sign-in email");
  }
}

export async function sendInviteEmail(input: { to: string; link: string }): Promise<void> {
  if (exposeDevCode()) return;
  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) {
    throw new HttpError(503, "Email sending is not configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "You're invited to PAN Parrot",
      text: [
        "An admin invited you to PAN Parrot.",
        "Open this link to sign in. It expires in 7 days.",
        "",
        input.link,
        "",
        "The link only works for this @paloaltonetworks.com address.",
        "If you were not expecting it, ignore the email.",
        "PAN Parrot is an unofficial personal tool, not a Palo Alto Networks service.",
        "Do not send secrets or customer data to it.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    console.error("Email provider rejected the invite", response.status);
    throw new HttpError(502, "Could not send the invite email");
  }
}
