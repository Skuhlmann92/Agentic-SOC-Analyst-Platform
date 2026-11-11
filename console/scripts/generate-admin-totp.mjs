// Run locally. NEVER paste the generated secret into chat, Git, or tickets.
// Add the Base32 value manually to an authenticator and as a Vercel server secret.
import { randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const secret = randomBytes(20);
let accumulator = 0, bits = 0, base32 = "";
for (const octet of secret) {
  accumulator = (accumulator << 8) | octet;
  bits += 8;
  while (bits >= 5) {
    bits -= 5;
    base32 += alphabet[(accumulator >>> bits) & 31];
    accumulator &= (1 << bits) - 1;
  }
}
if (bits > 0) base32 += alphabet[(accumulator << (5 - bits)) & 31];

console.log("SOC_ADMIN_TOTP_SECRET (Base32, store securely):", base32);
console.log("Authenticator configuration: TOTP / SHA-1 / 6 digits / 30 seconds");
