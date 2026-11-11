import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sealSession, openSession } from "../src/lib/session-token.ts";

const secret = "test-only-session-secret-not-for-production";
const base = {
  sub: "test-operator",
  name: "Test Operator",
  role: "analyst",
  tenantId: "22222222-2222-4222-8222-222222222222",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

test("valid signed session is accepted", async () => {
  const token = await sealSession(base, secret);
  assert.deepEqual(await openSession(token, secret), base);
});

test("tampered token is rejected", async () => {
  const token = await sealSession(base, secret);
  const [payload, signature] = token.split(".");
  const altered = payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A");
  assert.equal(await openSession(altered + "." + signature, secret), null);
});

test("expired session is rejected", async () => {
  const token = await sealSession({ ...base, exp: Math.floor(Date.now()/1000) - 10 }, secret);
  assert.equal(await openSession(token, secret), null);
});

test("unknown roles are rejected even with a valid signature", async () => {
  const token = await sealSession({ ...base, role: "superuser" }, secret);
  assert.equal(await openSession(token, secret), null);
});

test("missing and malformed tokens are rejected", async () => {
  for (const token of [undefined, "", "abc", "abc.def.ghi"]) {
    assert.equal(await openSession(token, secret), null);
  }
});

test("login mutation is not exempted before the origin guard", () => {
  const source = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
  const guard = source.indexOf('if(pathname.startsWith("/api/")');
  const bypass = source.indexOf('pathname === "/api/auth/login"');
  assert.ok(guard >= 0 && bypass > guard, "origin guard must precede login bypass");
  assert.match(source, /origin&&origin!==request\.nextUrl\.origin/);
});
