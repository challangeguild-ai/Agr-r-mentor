"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError("Sikertelen belépés. Ellenőrizd az e-mail címet és a jelszót.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">AM</div>
        <h1>Agrár Mentor</h1>
        <p>Belépés az ügyfélportálra</p>
        <label>E-mail cím<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Jelszó<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div className="error-box">{error}</div>}
        <button className="btn btn-primary full" disabled={loading}>{loading ? "Belépés…" : "Belépés"}</button>
      </form>
    </main>
  );
}
