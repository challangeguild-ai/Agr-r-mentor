# Agrár Mentor – technikai biztonsági dokumentáció

## 1. Cél és hatókör

Ez a dokumentum az Agrár Mentor alkalmazás biztonsági architektúráját, védelmi rétegeit, ellenőrzési pontjait és incidenskezelési logikáját foglalja össze. A cél nem a „feltörhetetlenség” ígérete, hanem a jogosulatlan hozzáférés, adatlopás, jogosultság-megkerülés és automatizált támadások kockázatának rétegzett csökkentése.

A dokumentumot minden authentikációt, jogosultságkezelést, fájlfeltöltést, exportot, adminfunkciót, adatbázis-hozzáférést, értesítést vagy biztonsági naplózást érintő fejlesztésnél felül kell vizsgálni.

## 2. Fő architektúra

- Frontend és szerveralkalmazás: Next.js 15, Vercel.
- Authentikáció és adatbázis: Supabase Auth + PostgreSQL.
- Jogosultságvédelem: PostgreSQL Row Level Security (RLS), szerveroldali szerepkör- és objektumjogosultság-ellenőrzések, célzott SECURITY DEFINER függvények.
- Fájltárolás: Supabase Storage, jogosultságvezérelt hozzáféréssel.
- Fő szerepkörök: szaktanácsadó, gazdálkodó/gazdasági felhasználó, valamint egyes funkcióknál további gazdasági jogosultsági szintek.
- Érzékeny szerveroldali műveletekhez külön service-role kliens használható; service-role kulcs kliensoldalra nem kerülhet.

## 3. Hitelesítés, MFA és munkamenet

A bejelentkezést Supabase Auth kezeli. A routing middleware csak gyors előszűrést végez; a hitelesítés és jogosultság ellenőrzése szerveroldalon történik a Supabase által ellenőrzött aktuális felhasználó alapján.

A jelszavas belépés AAL1 szintű munkamenetet jelent. A védett üzleti adatokhoz TOTP-alapú többtényezős hitelesítés után AAL2 szükséges. Első beállításkor a felhasználó QR-kód segítségével párosíthat kompatibilis authenticator alkalmazást, majd 6 jegyű TOTP-kóddal hitelesíti a faktort. A későbbi belépéseknél a jelszó mellett ez a második faktor is szükséges.

Biztonsági alapelvek:
- kliensoldali állításban nem bízunk meg;
- érzékeny szerverművelet előtt ismételten ellenőrizni kell a felhasználót és szerepkörét;
- jogosultságot objektumazonosító alapján is ellenőrizni kell;
- az üzleti adatokhoz való hozzáférésnél az AAL2 követelmény adatbázisszinten is érvényesül;
- MFA nélkül egy ellopott vagy megszerzett jelszó önmagában nem adhat teljes üzleti adathozzáférést.

## 4. Row Level Security és AAL2-korlát

Az üzleti adatokat tartalmazó public táblákon RLS aktív. A cél, hogy a felhasználó akkor se olvashassa vagy módosíthassa más gazdaság adatait, ha közvetlenül a Supabase API-t hívja meg vagy manipulálja a frontend kérést.

A fontos üzleti táblákon restriktív MFA-policy ellenőrzi az access token `aal` claimjét. A védett adatokhoz csak `aal2` munkamenet férhet hozzá. Így a második faktor nem pusztán felületi követelmény: közvetlen API-hívással sem kerülhető meg.

Kiemelt ellenőrzési esetek:
- Gazda A nem olvashatja Gazda B gazdaságát, földtábláit, szemléit, dokumentumait, teendőit, értesítéseit vagy műveleteit.
- Gazdasági munkatárs csak az általa elérhető gazdaság adatait láthatja.
- Szaktanácsadói jogosultság csak a szükséges szakmai adatokhoz ad hozzáférést.
- Admin vagy emelt jogosultság kizárólag indokolt szerveroldali folyamatban használható.
- AAL1 munkamenet a védett üzleti adatokhoz nem elegendő.

## 5. SECURITY DEFINER és RPC hardening

A rendszer SECURITY DEFINER adatbázis-függvényeket használhat olyan műveleteknél, amelyekhez RLS feletti kontrollált végrehajtás szükséges.

Követelmények:
- rögzített `search_path`;
- anon és public EXECUTE jog visszavonása, ha nincs rá szükség;
- `auth.uid()` / `auth.role()` alapú hívóellenőrzés;
- explicit objektumszintű jogosultság-ellenőrzés;
- inputvalidáció és hosszkorlátozás;
- minimális adatkibocsátás;
- minden SECURITY DEFINER függvény külön jogosultsági auditja.

A biztonsági eseménynapló írása különösen védett: a nyers `security_events` napló nem általános authenticated kliens-RPC. A naplóírást szerveroldali, service-role jogosultságú folyamat végzi, így normál felhasználó nem tudja közvetlenül manipulálni vagy teleszemetelni a security ledgert.

## 6. HTTP és böngészőoldali védelem

Az alkalmazás globális biztonsági HTTP headereket használ, többek között HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy és Cross-Origin-Resource-Policy beállításokkal. Az `X-Powered-By` fejléc kikapcsolása csökkenti a felesleges technológiai információszivárgást.

A Content Security Policy minden külső térkép-, média-, analytics- vagy más integráció módosításakor külön felülvizsgálandó.

## 7. Inputvalidáció és kimeneti biztonság

Minden felhasználói input nem megbízható adatnak minősül. Kötelező a típus- és formátumellenőrzés, szöveghossz-korlát, e-mail/telefonszám normalizálás, fájlméret- és fájltípus-korlát, valamint az objektumazonosítókhoz tartozó jogosultság ellenőrzése. Felhasználói HTML közvetlen renderelése kerülendő, belső audit- vagy technikai JSON ügyféloldalon nem jelenhet meg indokolatlanul.

## 8. Fájlok és dokumentumok

A szemlefotók, videók és dokumentumok érzékeny üzleti adatok lehetnek. A bucketek és objektumok nem lehetnek indokolatlanul publikusak; az olvasási és írási jogosultság gazdaság és szerepkör alapján korlátozandó. Fájlnév vagy objektumazonosító kitalálása nem eredményezhet hozzáférést idegen gazdaság fájljához.

## 9. Export, backup és step-up hitelesítés

Az export és backup kiemelt kockázatú, mert egyetlen hibával nagy mennyiségű adat kerülhet ki. A teljes backup/export ezért akkor is friss MFA-megerősítést igényel, ha a munkamenet már AAL2.

A felhasználó újra megadja az authenticator aktuális 6 jegyű kódját. Sikeres ellenőrzés után a szerver rövid, 5 perces, HMAC-aláírt step-up grantet ad HttpOnly, SameSite=Strict cookie-ban. A grant csak a backup útvonalra és kifejezetten export műveletre érvényes.

Az export route ellenőrzi:
- a bejelentkezett felhasználót;
- az AAL2 munkamenetet;
- a szükséges szaktanácsadói szerepkört;
- a friss, szerver által aláírt step-up grantet;
- a grant lejáratát és műveleti célját.

Sikeres export után a step-up cookie törlődik. A friss megerősítés tehát nem használható korlátlan, ismételt mentésekre. A friss MFA nélküli exportpróba, sikertelen step-up, sikeres export és exporthiba biztonsági eseményként naplózható.

## 10. Titkok kezelése

A step-up token HMAC-aláírásához külön `SECURITY_STEPUP_SECRET` szerveroldali környezeti változó szükséges, legalább 32 bájt véletlen entrópiával. A security ledger szerveroldali írásához `SUPABASE_SERVICE_ROLE_KEY` használható. Ezek nem kerülhetnek `NEXT_PUBLIC_` változóba, kliensoldali bundle-be vagy repositoryba.

A naplóba nem kerülhet jelszó, TOTP-kód, access/refresh token, service-role secret vagy teljes session cookie.

## 11. Biztonsági eseménynapló

A hardening réteg `security_events` naplót használ. Tipikus mezők: időpont, felhasználói azonosító, eseménytípus, súlyosság, 0–100 kockázati pontszám, IP-cím, közelítő ország/régió/város, user-agent, útvonal, HTTP-módszer, érintett objektum, technikai részletek, fingerprint, riasztási időpont és megőrzési határidő.

A raw security ledgerhez normál gazdálkodói vagy szaktanácsadói szerepkör nem kap közvetlen SELECT/INSERT jogosultságot.

## 12. Riasztási és kockázatértékelési modell

A rendszer nem egyetlen hibás próbálkozásra riaszt, hanem mintákat keres. Kockázati jel lehet sok sikertelen belépés, több fiók próbálgatása egy IP-ről, ugyanazon fiók támadása sok IP-ről, ismételt jogosultság-megtagadás, MFA/step-up hibák, tömeges exportpróba, szokatlan fájlfeltöltés, tiltott RPC/adminútvonal ismételt hívása vagy rövid idő alatt sok magas kockázatú esemény.

Az adminriasztás küszöbértékhez és mintához kötött; egyedi felhasználói hibák naplózódhatnak riasztás nélkül.

## 13. IP-cím és helyadat

Az IP-cím incidensvizsgálati adatként naplózható. Az IP-alapú földrajzi hely csak becslés; VPN, mobilhálózat, NAT és szolgáltatói routing miatt eltérhet a valós helytől. Az IP-cím önmagában nem bizonyítja, mely személy hajtotta végre a műveletet, és személyes adatnak minősülhet, ezért hozzáférése és megőrzése korlátozandó.

## 14. Megőrzés és adatminimalizálás

Alap biztonsági naplómegőrzés: 90 nap. Valós incidenshez kapcsolódó rekord külön döntés alapján, jogi és adatvédelmi követelmények figyelembevételével hosszabb ideig őrizhető.

## 15. Incidenskezelés

Magas vagy kritikus riasztás esetén javasolt folyamat:
1. esemény és kapcsolódó IP/fiók/időablak azonosítása;
2. kapcsolódó security események lekérése;
3. érintett sessionök, MFA-állapot és jogosultságok ellenőrzése;
4. szükség esetén jelszócsere, session-visszavonás vagy hozzáférés-korlátozás;
5. export-, dokumentum- és auditnaplók ellenőrzése;
6. érintett adatok körének meghatározása;
7. bizonyítékok megőrzése;
8. szükség esetén adatvédelmi és jogi incidensfolyamat elindítása.

## 16. Fejlesztési biztonsági szabály

Minden új funkciónál kötelező security check: új tábla esetén RLS/policy audit; új RPC esetén EXECUTE és SECURITY DEFINER audit; új fájlfunkciónál Storage policy audit; új inputnál validáció/XSS ellenőrzés; új exportnál jogosultság + friss MFA + auditnapló; új adminműveletnél objektumszintű authorization; új külső szolgáltatásnál secret és CSP ellenőrzés; szükség szerint a biztonsági dokumentáció frissítése.

## 17. Maradó kockázatok

A rendszer hardening után sem támadhatatlan. Maradó kockázat az adathalászat, kompromittált végpont vagy authenticator, null-day sérülékenység, kompromittált adminfiók, hibás infrastruktúra/DNS, rosszul kezelt külső titok, social engineering vagy platformszolgáltatói incidens.

A védelem ezért rétegzett: jelszó + TOTP MFA + AAL2 adatbázis-korlát + RLS + szerveroldali authorization + friss step-up hitelesítés exporthoz + inputvalidáció + biztonsági headerek + védett security ledger + riasztás + audit + mentések.