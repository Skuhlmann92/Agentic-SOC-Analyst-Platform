import { createHmac, timingSafeEqual } from "node:crypto";

// RFC 6238: 30-second, 6-digit TOTP using HMAC-SHA1 for broad authenticator compatibility.
// Secrets must come only from server-side configuration; never return them to the client.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer | null {
  const normalized = input.trim().toUpperCase().replace(/=+$/, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) return null;
  const result: number[] = [];
  let value = 0;
  let bits = 0;
  for (const char of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((value >>> bits) & 0xff);
    }
    value &= (1 << bits) - 1;
  }
  if (bits !== 0 && value !== 0) return null;
  // At least 160 bits of entropy is required for newly generated TOTP secrets.
  return result.length >= 20 ? Buffer.from(result) : null;
}

function totpAtStep(key: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  ) >>> 0;
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * Returns the matched 30-second counter or null. Checking adjacent windows
 * tolerates small clock skew; database consumption must reject reused counters.
 */
export function matchTotpStep(secret: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code) || !Number.isFinite(nowMs) || nowMs < 0) return null;
  const key = decodeBase32(secret);
  if (!key) return null;
  const currentStep = Math.floor(nowMs / 30_000);
  if (!Number.isSafeInteger(currentStep)) return null;
  const submitted = Buffer.from(code, "ascii");
  let matched: number | null = null;
  for (const shift of [-1, 0, 1]) {
    const step = currentStep + shift;
    if (step < 0) continue;
    const candidate = Buffer.from(totpAtStep(key, step), "ascii");
    if (timingSafeEqual(submitted, candidate)) matched = Math.max(matched ?? step, step);
  }
  return matched;
}
