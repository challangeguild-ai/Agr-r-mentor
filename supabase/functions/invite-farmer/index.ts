import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}
function fail(message: string, status: number, meta?: unknown) {
  console.error("invite-farmer error", { status, message, meta });
  return json({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Nem támogatott kérés.", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("Nincs hitelesítés.", 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return fail("Érvénytelen hitelesítési token.", 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceRoleKey) return fail("A Supabase szerveroldali konfiguráció hiányos.", 500);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData.user) return fail("Érvénytelen munkamenet.", 401, userError?.message);

    const { data: aal, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
    if (aalError) return fail("Az MFA állapot nem ellenőrizhető.", 401, aalError.message);
    if (aal?.currentLevel !== "aal2") return fail("Ehhez a művelethez kétlépcsős hitelesítés szükséges.", 403, { code: "MFA_REQUIRED" });

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role,system_role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) return fail(`Profil ellenőrzési hiba: ${profileError.message}`, 500);
    if (profile?.role !== "advisor" || profile?.system_role === "admin") {
      return fail("Ehhez szaktanácsadói jogosultság szükséges.", 403, { role: profile?.role, system_role: profile?.system_role });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const redirectTo = String(body.redirect_to || "").trim();
    if (!email || !email.includes("@") || email.length > 250) return fail("Érvényes e-mail cím szükséges.", 400);
    if (fullName.length > 120) return fail("A név túl hosszú.", 400);
    if (redirectTo && !redirectTo.startsWith("https://agr-r-mentor.vercel.app/")) return fail("Érvénytelen visszatérési cím.", 400);

    const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName || email, role: "farmer" },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (error) return fail(error.message, error.status || 400, { code: error.code, name: error.name });

    if (data.user?.id) {
      const { error: profileUpsertError } = await adminClient.from("profiles").upsert(
        { id: data.user.id, full_name: fullName || email, role: "farmer", system_role: "user" },
        { onConflict: "id" },
      );
      if (profileUpsertError) return fail(`A felhasználó létrejött, de a profil mentése sikertelen: ${profileUpsertError.message}`, 500);
    }

    console.log("invite-farmer success", { email, userId: data.user?.id || null, actor: userData.user.id });
    return json({ id: data.user?.id, email: data.user?.email, invited: true, role: "farmer" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    console.error("invite-farmer unhandled", error);
    return json({ error: message }, 500);
  }
});
