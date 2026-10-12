"use client";

import { Radio as Logo } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.getElementById("username")?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, next }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; message?: string };
      if (res.ok && data.ok) {
        window.location.href = data.next ?? "/dashboard";
        return;
      }
      setProblem(data.message ?? "Could not sign in. Try again.");
    } catch {
      setProblem("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  const field = "mt-1.5 h-10 w-full rounded-chip border border-border bg-bg px-3 text-sm";
  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-chip bg-accent text-accent-fg"><Logo size={20} aria-hidden /></span>
          <span className="text-lg font-semibold">Podcast Intelligence</span>
        </div>
        <div className="rounded-panel border border-border bg-surface p-6">
          <h1 className="text-[22px] font-semibold leading-7">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Admin access only.</p>
          {problem ? <p role="alert" className="mt-5 rounded-chip bg-danger-soft p-3 text-sm text-danger">{problem}</p> : null}
          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label htmlFor="username" className="block text-sm font-medium">Username</label>
              <input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </div>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !username || !password}>{busy ? "Signing in..." : "Sign in"}</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
