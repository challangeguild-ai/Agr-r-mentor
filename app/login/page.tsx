"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(`Sikertelen belépés: ${error.message}`);
      return;
    }

    const requestedNext = safeNext(new URLSearchParams(window.location.search).get("next"));
    let target = requestedNext;

    if (!target && data.user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      target = profile?.role === "advisor" ? "/admin" : "/dashboard";
    }

    setLoading(false);
    window.location.assign(target || "/dashboard");
  }

  async function handleRecovery() {
    setError("");
    setMessage("");
    if (!email) {
      setError("Add meg előbb az e-mail címedet.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      setError(`A visszaállító e-mail küldése sikertelen: ${error.message}`);
      return;
    }

    setMessage("Elküldtük a jelszó-visszaállító e-mailt. Ellenőrizd a beérkező leveleket és a spam mappát is.");
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">AM</div>
        <h1>Agrár Mentor</h1>
        <p>Belépés az ügyfélportálra</p>
        <label>E-mail cím<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Jelszó<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}
        <button className="btn btn-primary full" disabled={loading}>{loading ? "Belépés…" : "Belépés"}</button>
        <button type="button" className="btn full" onClick={handleRecovery} disabled={loading}>Elfelejtett jelszó</button>
      </form>
    </main>
  );
}
