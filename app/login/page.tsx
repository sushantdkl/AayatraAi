"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Sign in failed");
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand" aria-label="Aayatra Sales Engine">
        <div className="brand-mark large">A</div>
        <div className="login-brand-content">
          <p className="brand-overline">AAYATRA ENTERPRISES</p>
          <h1>
            Good sales start with
            <br />
            <em>good judgment.</em>
          </h1>
          <p>
            One place for the businesses worth knowing, the opportunities worth
            pursuing, and the facts behind every decision.
          </p>
        </div>
        <p className="login-brand-foot">
          Software · AI · Automation · Digital Systems
        </p>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="login-lock">
            <LockKeyhole size={21} strokeWidth={1.7} />
          </div>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use your Aayatra team account to continue.</p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(""); }}
              placeholder="you@aayatra.com"
            />
          </label>
          <label htmlFor="login-password">Password</label>
          <div className="login-password-field">
            <input
              id="login-password"
              type={passwordVisible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(""); }}
            />
            <button
              className="login-password-toggle"
              type="button"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-controls="login-password"
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary login-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={17} />
          </button>
          <p className="login-help">
            Need access? Ask your workspace owner to set up your account.
          </p>
        </form>
      </section>
    </main>
  );
}
