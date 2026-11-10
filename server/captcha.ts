import { env } from "./config";

export type CaptchaProvider = "turnstile" | "hcaptcha";

export function captchaConfig(): { provider: CaptchaProvider; siteKey: string; secret: string; after: number } | null {
  const provider = env("CAPTCHA_PROVIDER");
  const siteKey = env("CAPTCHA_SITE_KEY") || "";
  const secret = env("CAPTCHA_SECRET_KEY") || "";
  if ((provider !== "turnstile" && provider !== "hcaptcha") || !siteKey || !secret) return null;
  const always = env("CAPTCHA_ALWAYS") === "true";
  const after = always ? 0 : Number(env("CAPTCHA_AFTER_FAILURES") || "3");
  return { provider, siteKey, secret, after: Number.isFinite(after) ? Math.max(0, after) : 3 };
}

export async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
  const config = captchaConfig();
  if (!config) return true;
  if (!token) return false;
  const url =
    config.provider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://hcaptcha.com/siteverify";
  const body = new URLSearchParams({ secret: config.secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const response = await fetch(url, { method: "POST", body });
    if (!response.ok) return false;
    const payload = (await response.json()) as { success?: boolean };
    return payload.success === true;
  } catch {
    return false;
  }
}
