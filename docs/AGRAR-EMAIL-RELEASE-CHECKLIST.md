# AgrárMentor – a teljes levelezési modul kiadási ellenőrzése

Állapot: **Draft / helyi PostgreSQL-próba sikeres, nem élesítve.** 2026. november 20.

## A csomag részei

- **Meghívók:** `invite-farmer`, `invite-advisor`; jogosultság, kötelező MFA, kizárólag a beállított HTTPS `/invite` cím, címazonosítás, meghívónkénti szigorú szerveroldali keret (**10/óra, 30/nap** egy küldőre).
- **Munkafolyamatok:** munkakiosztás, szaktanácsadói teendő és műveleti terv, táblaszemle, gazdálkodói bejelentés és szaktanácsadói válasz, befejezett feladat ellenőrzésre küldése.
- **E-mail-kapu:** csak valós, mentett üzleti esemény **és** címzetthez mentett alkalmazásértesítés után küld. A tényleges feladatvégrehajtó gazdasági munkatárs is lehet, nem csupán farmer vagy advisor profilú. Önkiosztott feladathoz saját e-mail is engedélyezett, de csak bizonyított eseménnyel.
- **E-mail-védelem:** átviteli e-mail limit (**60/óra, 200/nap**), üzleti eseményhez kötött Resend idempotenciakulcs, 15 másodperces szolgáltatói időkorlát, belső hiba elrejtése a végfelhasználótól, HTML-escape és kizárólag jóváhagyott HTTPS-eredetű link.
- **Mellékfolyamatok:** ha a feladat már mentve van, egy sikertelen értesítés nem teheti a teljes műveletet hamisan sikertelenné; az értesítési hibát jelezni kell és a belső értesítési napló visszakereshető.

## Kiadási sorrend – **csak külön jóváhagyás után**

1. **Teljesítve (2026.11.20.):** a visszaállított **helyi** Docker-adatbázison az öt migráció egy tranzakcióban sikeresen lefutott. A séma-/jogosultságtesztek, a 61. értesítő e-mail és a 11. meghívó tiltása sikeres; a végén `ROLLBACK` történt, az eredeti adatok megmaradtak.
2. Az öt SQL-migráció élesítési tervét és előzetes mentését ellenőrizni. A `20261119211340_notification_email_send_quota.sql` **előbb** alkalmazandó, mint a három frissített Edge Function.
3. A Supabase szerveroldali kulcsait és `APP_PUBLIC_ORIGIN` HTTPS-eredetét ellenőrizni a `send-notification-email`, `invite-farmer`, `invite-advisor` funkcióknál. A `send-notification-email` külön `RESEND_API_KEY` és ellenőrzött küldődomaint igényel (`NOTIFICATION_EMAIL_FROM`). A meghívókat a Supabase **Auth e-mail-szolgáltatása** küldi; annak SMTP-beállítása, sablonja, kvótája és Auth redirect URL-allowlistje külön ellenőrzendő.
4. Ezután a **mindhárom** frissített Edge Functiont és a közös `_shared` fájlokat egy ütemben telepíteni. Az egységes `X-AgrarMentor-Email-Release` válaszfejléc értéke `2026-11-20-email-v1`; ezzel az új kiadás azonosítható. A Vercel Preview kódfrissítése **önmagában nem frissíti** a már telepített Supabase Edge Functionöket.
5. Engedélyezett tesztfiókokkal, valódi postaládával, ellenőrzött célcímen kézi próbák: rendszeradmin → advisor meghívó; advisor → farmer meghívó; farmtulajdonos → munkatárs meghívó + csatlakozás; advisor → gazda teendő/szemle/válasz; gazda → végrehajtó munkakiosztás; végrehajtó → advisor ellenőrzésre beküldés. Ellenőrizendő: sikeres kézbesítés, működő link, helyes címzett és role, azonos esemény ismétlése nem küld több levelet, idegen címzett elutasítása, hálózati hiba jelzése.
6. A küldési domain SPF/DKIM/DMARC, spam-besorolás, Resend / Supabase Auth szolgáltatói naplók és a címzetti postaláda összevetése után jöhet csak a production-közzététel.

**Fontos korlát:** a helyi SQL-próba **sikeres**, de az éles adatbázisban a migrációk még nincsenek alkalmazva. A helyi tesztek és a Next.js build **nem igazolják** az éles levelek tényleges kézbesítését, a Supabase Auth SMTP és a Resend beállításait. Ezek külön kiadási kapuk.
