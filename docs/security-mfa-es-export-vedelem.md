# Agrár Mentor – MFA és érzékeny exportvédelem

## Technikai összefoglaló

Az Agrár Mentor érzékeny üzleti adatainak eléréséhez a rendszer TOTP-alapú kétfaktoros hitelesítést használ. A felhasználó jelszavas bejelentkezése önmagában csak AAL1 munkamenetet hoz létre; a védett üzleti adatokhoz AAL2 szükséges.

A második faktor Supabase Auth MFA/TOTP. Első használatkor a felhasználó QR-kódot olvas be Google Authenticator, Microsoft Authenticator vagy kompatibilis TOTP alkalmazással, majd egy 6 jegyű kóddal hitelesíti a faktort. Következő belépéseknél a jelszó után ugyanilyen rövid életű kód szükséges.

A fontos üzleti táblákon az MFA-követelmény nem csak UI-szinten érvényesül. Restriktív RLS policy ellenőrzi az access token `aal` claimjét, és csak `aal2` munkamenet esetén enged hozzáférést. Ez azt jelenti, hogy egy támadó nem kerülheti meg egyszerűen a második faktort azzal, hogy közvetlenül a Supabase API-t vagy egy kézzel összeállított klienskérést használ.

### Friss MFA az export előtt

A teljes backup/export külön step-up hitelesítést igényel akkor is, ha a munkamenet már AAL2. A felhasználónak újra meg kell adnia az authenticator aktuális 6 jegyű kódját.

Sikeres ellenőrzés után a szerver egy rövid, 5 perces, HMAC-aláírt jogosultsági tokent helyez HttpOnly, SameSite=Strict cookie-ba. A cookie csak a backup útvonalra érvényes. A teljes export route ellenőrzi:

- a bejelentkezett felhasználót;
- az AAL2 munkamenetet;
- a szaktanácsadói szerepkört;
- a friss, szerver által aláírt step-up grantet;
- a grant lejáratát és azt, hogy kifejezetten export műveletre szól-e.

Sikeres export után a step-up cookie törlődik, ezért ugyanaz a friss megerősítés nem használható korlátlanul ismételt mentésekre.

### Titkok kezelése

A step-up token HMAC-aláírásához külön `SECURITY_STEPUP_SECRET` szerveroldali környezeti változó szükséges, legalább 32 bájt véletlen entrópiával. A biztonsági eseménynapló szerveroldali írásához `SUPABASE_SERVICE_ROLE_KEY` szükséges. Ezek egyike sem kerülhet `NEXT_PUBLIC_` változóba vagy kliensoldali bundle-be.

### Biztonsági naplózás

Az export újrahitelesítés sikeres és sikertelen kísérlete, a friss MFA nélküli exportpróba, az export sikere és hibája biztonsági eseményként naplózható. A napló tartalmazhatja a felhasználói azonosítót, időpontot, IP-címet, Vercel által biztosított közelítő földrajzi metaadatot, user-agentet, eseménytípust és kockázati pontszámot.

A nyers `security_events` táblához normál authenticated kliens nem kap közvetlen írási vagy olvasási jogosultságot. A naplóírás kizárólag szerveroldali service-role kliensen keresztül történik.

## Közérthetően

A jelszó mostantól nem az egyetlen kulcs. A belépéshez egy második, folyamatosan változó 6 jegyű kód is kell, amelyet a felhasználó saját authenticator alkalmazása állít elő.

Ez azért fontos, mert ha valaki megszerzi vagy kitalálja a jelszót, attól még nem kapja meg automatikusan a gazdaság adatait. A rendszer adatbázisa is ellenőrzi, hogy a második faktor valóban megtörtént-e.

A teljes adatmentés ennél is szigorúbb. Hiába van valaki már bent kétfaktorosan a rendszerben, a teljes export gomb megnyomásakor új authenticator-kódot kérünk. Ennek az az oka, hogy egy nyitva hagyott számítógép, ellopott munkamenet vagy kompromittált böngésző ne tudjon egyetlen kattintással nagy mennyiségű ügyféladatot letölteni.

A friss megerősítés csak rövid ideig él, és sikeres export után elhasználódik. A rendszer közben naplózza a fontos export- és hitelesítési eseményeket, hogy egy későbbi incidensnél vissza lehessen nézni, mi történt.
