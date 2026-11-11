import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const login = readFileSync(new URL("../src/app/api/auth/login/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");

test("production login disables local sample credentials", () => {
  assert.match(login, /process\.env\.NODE_ENV === "production" \|\| process\.env\.ENABLE_LOCAL_OPERATORS !== "true"/);
});

test("administrator password is read from server environment", () => {
  assert.match(login, /process\.env\.SOC_ADMIN_PASSWORD/);
  assert.match(login, /timingSafeEqual/);
});

test("administrator login has server-side throttling", () => {
  assert.match(login, /checkLoginThrottle\(request,"admin"\)/);
  assert.match(login, /status:429/);
});

test("session cookies are httpOnly and sameSite", () => {
  assert.match(login, /httpOnly:\s*true/g);
  assert.match(login, /sameSite:\s*"lax"/g);
});

test("security middleware exists", () => {
  assert.ok(middleware.length > 0);
});
