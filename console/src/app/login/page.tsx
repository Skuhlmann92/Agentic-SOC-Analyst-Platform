"use client";

import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const operator = "admin";
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function openDemo() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });
      if (!response.ok) throw new Error("Demo sign-in failed.");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Demo sign-in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operator, password, totp }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json()) as { error?: { message?: string } };
      setError(body.error?.message || "Sign-in failed.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form className="panel w-full max-w-md rounded-xl p-6" onSubmit={submit}>
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-lg font-semibold">Security Operations Console</h1>
            <p className="text-sm text-muted-foreground">Sign in to a tenant workspace.</p>
          </div>
        </div>
        <div className="mb-5 rounded-lg border border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-medium">Public SOC demo</p>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Explore fictional security alerts and investigations. No password or tenant ID required.</p>
          <Button type="button" className="w-full" disabled={pending} onClick={openDemo}>Open demo dashboard</Button>
        </div>
        <p className="mb-3 text-xs uppercase text-muted-foreground">Private SOC administrator sign-in</p>
        <div className="field mb-3 flex items-center justify-between text-sm"><span>SOC Administrator</span><span className="text-xs text-muted-foreground">Private workspace</span></div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Password</span>
          <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Authenticator-Code</span>
          <input className="field" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value)} />
        </label>
        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in" : "Enter console"}
        </Button>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Enter the private SOC administrator password configured in Vercel. No tenant ID is needed. The public demo remains read-only.
        </p>
      </form>
    </main>
  );
}
