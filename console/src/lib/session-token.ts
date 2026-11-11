export const SESSION_COOKIE = "soc_session";

export type Role = "analyst" | "reviewer" | "admin";

export type SessionClaims = {
  sub: string;
  role: Role;
  name: string;
  tenantId: string;
  exp: number;
  // Present only after successful password + server-side TOTP verification.
  mfaVerifiedAt?: number;
};

// Configuring a TOTP secret itself activates enforcement, even if the flag is omitted.
export function adminMfaRequired() {
  return process.env.SOC_REQUIRE_ADMIN_MFA === "true" || Boolean(process.env.SOC_ADMIN_TOTP_SECRET?.trim());
}

export function sessionSecret() {
  const configured=process.env.CONSOLE_SESSION_SECRET;
  if(configured)return configured;
  if(process.env.NODE_ENV==="production")throw new Error("CONSOLE_SESSION_SECRET is required in production");
  return "dev-console-session";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function same(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export async function sealSession(claims: SessionClaims, secret = sessionSecret()) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function openSession(token: string | undefined, secret = sessionSecret()): Promise<SessionClaims | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || token.split(".").length !== 2) return null;
  if (!same(signature, await hmac(secret, payload))) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as SessionClaims;
    if (!claims.exp || claims.exp < Date.now() / 1000) return null;
    if (claims.role !== "analyst" && claims.role !== "reviewer" && claims.role !== "admin") return null;
    if (!claims.tenantId || !claims.name || !claims.sub) return null;
    // Invalidates pre-MFA administrator sessions as soon as MFA is enabled.
    if (claims.role === "admin" && adminMfaRequired()) {
      const now = Math.floor(Date.now() / 1000);
      if (typeof claims.mfaVerifiedAt !== "number" || !Number.isSafeInteger(claims.mfaVerifiedAt)) return null;
      if (claims.mfaVerifiedAt > now + 30 || claims.mfaVerifiedAt < now - 8 * 60 * 60) return null;
    }
    return claims;
  } catch {
    return null;
  }
}
