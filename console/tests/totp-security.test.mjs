import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchTotpStep } from "../src/lib/totp.ts";
import { adminMfaRequired, openSession, sealSession } from "../src/lib/session-token.ts";

// RFC 6238 Appendix B uses this Base32-encoded 20-byte test key.
// 8-digit result 94287082 at T=59 -> the interoperable 6-digit result 287082.
const referenceSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const signingKey = "test-signing-key-not-for-production";
const adminSession = {
  sub: "socadmin",
  role: "admin",
  name: "SOC Administrator",
  tenantId: "33333333-3333-4333-8333-333333333333",
  exp: Math.floor(Date.now() / 1000) + 1800,
};

test("TOTP matches RFC 6238 HMAC-SHA1 reference vector", () => {
  assert.equal(matchTotpStep(referenceSecret, "287082", 59_000), 1);
});

test("TOTP tolerates one adjacent step but not two", () => {
  assert.equal(matchTotpStep(referenceSecret, "287082", 89_000), 1);
  assert.equal(matchTotpStep(referenceSecret, "287082", 119_000), null);
});

test("TOTP rejects malformed tokens and too-short or invalid keys", () => {
  assert.equal(matchTotpStep(referenceSecret, "28708", 59_000), null);
  assert.equal(matchTotpStep(referenceSecret, "287082 ", 59_000), null);
  assert.equal(matchTotpStep(referenceSecret, "wrong!", 59_000), null);
  assert.equal(matchTotpStep("INVALID!SECRET", "287082", 59_000), null);
  assert.equal(matchTotpStep("JBSWY3DP", "287082", 59_000), null);
  assert.equal(matchTotpStep(referenceSecret, "287082", -1), null);
});

test("MFA requirement is enabled by flag or presence of TOTP secret", () => {
  const oldFlag = process.env.SOC_REQUIRE_ADMIN_MFA;
  const oldSecret = process.env.SOC_ADMIN_TOTP_SECRET;
  try {
    delete process.env.SOC_REQUIRE_ADMIN_MFA;
    delete process.env.SOC_ADMIN_TOTP_SECRET;
    assert.equal(adminMfaRequired(), false);
    process.env.SOC_REQUIRE_ADMIN_MFA = "true";
    assert.equal(adminMfaRequired(), true);
    delete process.env.SOC_REQUIRE_ADMIN_MFA;
    process.env.SOC_ADMIN_TOTP_SECRET = referenceSecret;
    assert.equal(adminMfaRequired(), true);
  } finally {
    if (oldFlag === undefined) delete process.env.SOC_REQUIRE_ADMIN_MFA;
    else process.env.SOC_REQUIRE_ADMIN_MFA = oldFlag;
    if (oldSecret === undefined) delete process.env.SOC_ADMIN_TOTP_SECRET;
    else process.env.SOC_ADMIN_TOTP_SECRET = oldSecret;
  }
});

test("Enabling MFA invalidates administrator sessions lacking verified assurance", async () => {
  const oldFlag = process.env.SOC_REQUIRE_ADMIN_MFA;
  const oldSecret = process.env.SOC_ADMIN_TOTP_SECRET;
  try {
    process.env.SOC_REQUIRE_ADMIN_MFA = "true";
    delete process.env.SOC_ADMIN_TOTP_SECRET;
    const legacy = await sealSession(adminSession, signingKey);
    assert.equal(await openSession(legacy, signingKey), null);
    const verified = await sealSession({
      ...adminSession,
      mfaVerifiedAt: Math.floor(Date.now() / 1000),
    }, signingKey);
    assert.equal((await openSession(verified, signingKey))?.role, "admin");
    const stale = await sealSession({
      ...adminSession,
      mfaVerifiedAt: Math.floor(Date.now() / 1000) - 9 * 3600,
    }, signingKey);
    assert.equal(await openSession(stale, signingKey), null);
  } finally {
    if (oldFlag === undefined) delete process.env.SOC_REQUIRE_ADMIN_MFA;
    else process.env.SOC_REQUIRE_ADMIN_MFA = oldFlag;
    if (oldSecret === undefined) delete process.env.SOC_ADMIN_TOTP_SECRET;
    else process.env.SOC_ADMIN_TOTP_SECRET = oldSecret;
  }
});

test("Admin login verifies TOTP before sealing elevated session", () => {
  const source = readFileSync(new URL("../src/app/api/auth/login/route.ts", import.meta.url), "utf8");
  const check = source.indexOf("verifyAndConsumeAdminTotp");
  const call = source.lastIndexOf("verifyAndConsumeAdminTotp");
  const issue = source.indexOf("const token = await sealSession", call);
  assert.ok(check >= 0 && call > check && issue > call);
  assert.match(source, /mfaVerifiedAt/);
});

test("Replay consumption uses atomic database upsert with counter increase", () => {
  const source = readFileSync(new URL("../src/lib/admin-mfa.ts", import.meta.url), "utf8");
  assert.match(source, /ON CONFLICT \(principal\) DO UPDATE/);
  assert.match(source, /last_step < EXCLUDED\.last_step/);
  assert.match(source, /return rows\.length === 1/);
});
