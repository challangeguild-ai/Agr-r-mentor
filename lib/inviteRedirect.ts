/** Server-only invite destination. Never infer this from an untrusted Host header. */
export function getInviteRedirectUrl(): string {
  const raw = process.env.APP_PUBLIC_ORIGIN?.trim();
  if (!raw) throw new Error("Az alkalmazás nyilvános címe (APP_PUBLIC_ORIGIN) nincs beállítva. Meghívás nem küldhető biztonságosan.");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Érvénytelen APP_PUBLIC_ORIGIN: teljes HTTPS webcím szükséges."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("Az APP_PUBLIC_ORIGIN csak HTTPS eredetcím lehet, útvonal és paraméter nélkül.");
  return new URL("/invite", url).toString();
}
