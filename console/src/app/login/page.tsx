"use client";

import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [operator, setOperator] = useState("analyst");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
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
      body: JSON.stringify({ operator, password, tenantId }),
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
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Operator</span>
          <select className="field" value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="analyst">Analyst</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Password</span>
          <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-muted-foreground">Tenant</span>
          <input
            className="field font-mono"
            value={tenantId}
            placeholder="Optional for private admin (assigned automatically)"
            onChange={(event) => setTenantId(event.target.value)}
          />
        </label>
        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in" : "Enter console"}
        </Button>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          For live Wazuh/EDR data, choose Administrator and enter your private SOC password. Tenant ID is assigned automatically. Demo access is read-only.
        </p>
      </form>
    </main>
  );
}
