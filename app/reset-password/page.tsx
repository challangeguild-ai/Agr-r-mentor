"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("A jelszó legalább 8 karakter legyen.");
      return;
    }
    if (password !== confirmPassword) {
      setError("A két jelszó nem egyezik.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(`A jelszó módosítása sikertelen: ${error.message}`);
      return;
    }
    setMessage("A jelszavad sikeresen megváltozott. Átirányítunk a belépéshez…");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">AM</div>
        <h1>Új jelszó</h1>
        <p>Adj meg egy új jelszót az Agrár Mentor fiókodhoz.</p>
        {!ready && <div className="error-box">Nyisd meg ezt az oldalt a jelszó-visszaállító e-mailben kapott linkről.</div>}
        <label>Új jelszó<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <label>Új jelszó újra<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required /></label>
        {error && <div className="error-box">{error}</div>}
        {message && <div className="success-box">{message}</div>}
        <button className="btn btn-primary full" disabled={loading || !ready}>{loading ? "Mentés…" : "Új jelszó mentése"}</button>
      </form>
    </main>
  );
}
