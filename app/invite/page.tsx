"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function prepareInviteSession() {
      const supabase = createClient();
      setReady(false);
      setError("");

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type");
      const code = new URL(window.location.href).searchParams.get("code");

      // Meghívást kizárólag a linkben érkező invite/session tokenből fogadunk el.
      // A böngészőben már meglévő admin vagy más user session NEM használható aktiválásra.
      if (!accessToken && !code) {
        if (active) {
          setError("Érvénytelen vagy hiányos meghívó link. Nyisd meg újra a meghívó e-mailből.");
        }
        return;
      }

      try {
        // Töröljük csak a böngésző aktuális helyi sessionjét, hogy egy admin belépés
        // semmiképp se lehessen a jelszóbeállítás célpontja.
        await supabase.auth.signOut({ scope: "local" });

        let sessionUserEmail = "";

        if (accessToken && refreshToken) {
          if (type && type !== "invite" && type !== "signup" && type !== "recovery") {
            throw new Error("A link típusa nem használható fiókaktiválásra.");
          }

          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError || !data.session?.user) {
            throw new Error(sessionError?.message || "A meghívó munkamenet nem hozható létre.");
          }
          sessionUserEmail = data.session.user.email || "";
        } else if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError || !data.session?.user) {
            throw new Error(exchangeError?.message || "A meghívó kód nem váltható munkamenetre.");
          }
          sessionUserEmail = data.session.user.email || "";
        }

        if (!sessionUserEmail) {
          throw new Error("A meghívott felhasználó nem azonosítható.");
        }

        if (active) {
          setInviteEmail(sessionUserEmail);
          setReady(true);
        }

        // A tokeneket eltávolítjuk a címsorból, hogy ne maradjanak láthatók/elmenthetők.
        window.history.replaceState({}, document.title, "/invite");
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? `A meghívó feldolgozása sikertelen: ${err.message}` : "A meghívó feldolgozása sikertelen.");
          setReady(false);
        }
      }
    }

    prepareInviteSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!ready) {
      setError("A meghívó nincs érvényesen betöltve.");
      return;
    }
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

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || (inviteEmail && userData.user.email !== inviteEmail)) {
      setLoading(false);
      setReady(false);
      setError("A meghívott felhasználó munkamenete nem érvényes. Nyisd meg újra a meghívó linket.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(`A fiók aktiválása sikertelen: ${updateError.message}`);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">AM</div>
        <h1>Fiók aktiválása</h1>
        <p>Állíts be jelszót az Agrár Mentor ügyfélfiókodhoz.</p>
        {inviteEmail && <div className="notice">Meghívott fiók: <strong>{inviteEmail}</strong></div>}
        {!ready && !error && <div className="notice">Meghívó ellenőrzése…</div>}
        {error && <div className="error-box">{error}</div>}
        <label>Új jelszó<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required disabled={!ready} /></label>
        <label>Új jelszó újra<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required disabled={!ready} /></label>
        <button className="btn btn-primary full" disabled={loading || !ready}>{loading ? "Aktiválás…" : "Fiók aktiválása"}</button>
      </form>
    </main>
  );
}
