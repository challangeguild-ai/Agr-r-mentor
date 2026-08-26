# Agrár Mentor – technikai biztonsági dokumentáció

## 1. Cél és hatókör

Ez a dokumentum az Agrár Mentor alkalmazás biztonsági architektúráját, védelmi rétegeit, ellenőrzési pontjait és incidenskezelési logikáját foglalja össze. A cél nem az, hogy a rendszert „feltörhetetlennek” minősítse – ilyen rendszer nem létezik –, hanem hogy dokumentálja, milyen kontrollok csökkentik az illetéktelen hozzáférés, adatlopás, jogosultság-megkerülés és automatizált támadás kockázatát.

A dokumentumot minden olyan fejlesztésnél felül kell vizsgálni, amely az authentikációt, jogosultságkezelést, fájlfeltöltést, exportot, adminfunkciókat, adatbázis-hozzáférést, értesítéseket vagy biztonsági naplózást érinti.

## 2. Fő architektúra

- Frontend / szerveralkalmazás: Next.js 15, Vercel.
- Authentikáció és adatbázis: Supabase Auth + PostgreSQL.
- Jogosultságvédelem: PostgreSQL Row Level Security (RLS), szerveroldali szerepkör-ellenőrzések, célzott SECURITY DEFINER függvények.
- Fájltárolás: Supabase Storage, jogosultságvezérelt hozzáféréssel.
- Fő szerepkörök: szaktanácsadó, gazdálkodó / gazdasági felhasználó; egyes gazdasági funkcióknál további jogosultsági szintek.

## 3. Hitelesítés és munkamenet

A bejelentkezést Supabase Auth kezeli. A routing middleware csak gyors előszűrést végez az auth-cookie meglétére; a hitelesítés és a jogosultság ellenőrzése szerveroldalon történik a Supabase által ellenőrzött aktuális felhasználó alapján.

Biztonsági elv:
- kliensoldali állításban nem bízunk meg;
- érzékeny szerver action előtt ismételten ellenőrizni kell a felhasználót és szerepkörét;
- jogosultságot objektumazonosító alapján is ellenőrizni kell, nem elég azt ellenőrizni, hogy a felhasználó általában be van jelentkezve.

## 4. Row Level Security

Az üzleti adatokat tartalmazó public táblákon RLS aktív. A cél, hogy a felhasználó akkor se olvashassa vagy módosíthassa más gazdaság adatait, ha közvetlenül a Supabase API-t hívja meg vagy manipulálja a frontend kérést.

Kiemelt ellenőrzési esetek:
- Gazda A nem olvashatja Gazda B gazdaságát, földtábláit, szemléit, dokumentumait, teendőit, értesítéseit vagy műveleteit.
- Gazdasági munkatárs csak az általa elérhető gazdaság adatait láthatja.
- Szaktanácsadói jogosultság csak a szükséges szakmai adatokhoz ad hozzáférést.
- Admin vagy emelt jogosultság kizárólag kifejezetten indokolt szerveroldali folyamatban használható.

## 5. SECURITY DEFINER és RPC hardening

A rendszer használ SECURITY DEFINER adatbázis-függvényeket olyan műveleteknél, amelyekhez RLS feletti kontrollált végrehajtás szükséges.

Követelmények minden ilyen függvénynél:
- rögzített `search_path`;
- anon és public EXECUTE jog visszavonása, ha nincs kifejezetten szükség rá;
- a hívó felhasználó `auth.uid()` / `auth.role()` alapú ellenőrzése;
- a célobjektumhoz való jogosultság explicit ellenőrzése;
- inputok érvényesítése és hosszkorlátozása;
- a függvény ne adjon ki a szükségesnél több adatot.

A hardening audit során minden SECURITY DEFINER függvényt külön jogosultsági tesztnek kell alávetni.

## 6. HTTP és böngészőoldali biztonsági fejlécek

Az alkalmazás globális biztonsági HTTP headereket használ:
- HSTS;
- X-Content-Type-Options: nosniff;
- X-Frame-Options: DENY;
- szigorított Referrer-Policy;
- Permissions-Policy;
- Cross-Origin-Opener-Policy;
- Cross-Origin-Resource-Policy;
- a technológiát feleslegesen felfedő `X-Powered-By` fejléc kikapcsolása.

A Content Security Policy külön felülvizsgálandó minden külső térkép-, média-, analytics- vagy más integráció módosításakor, mert túl szigorú CSP funkcióhibát, túl laza CSP XSS-kockázatot okozhat.

## 7. Inputvalidáció és kimeneti biztonság

Alapelv: minden felhasználói input nem megbízható adat.

Kontrollok:
- típus- és formátumellenőrzés;
- szöveghossz-korlátok;
- e-mail és telefonszám validáció / normalizálás;
- fájl típus- és méretkorlátok;
- azonosítókhoz kapcsolódó objektumszintű jogosultság-ellenőrzés;
- felhasználói HTML közvetlen renderelésének kerülése;
- nyers technikai JSON vagy belső auditadat nem jelenhet meg ügyféloldalon.

## 8. Fájlok és dokumentumok

A szemlefotók, videók és dokumentumok érzékeny üzleti adatok lehetnek.

Követelmények:
- a bucketek és objektumok ne legyenek indokolatlanul publikusak;
- olvasási és írási jogosultság gazdaság / szerepkör alapján legyen korlátozva;
- feltöltésnél fájltípus- és méretkorlát;
- fájlnév alapján ne lehessen jogosultságot kitalálni vagy megkerülni;
- idegen gazdaság objektumazonosítójával ne lehessen fájlt elérni.

## 9. Export, backup és tömeges adatkiadás

Az export és backup funkciók kiemelt kockázatúak, mert egyetlen jogosultsági hiba nagy mennyiségű adat kiszivárgását okozhatja.

Követelmények:
- csak jogosult szerepkör hívhatja;
- minden export esemény naplózandó;
- tömeges vagy szokatlan exportpróba emelje a kockázati pontszámot;
- backup funkció anonim vagy normál felhasználói RPC-ként nem érhető el;
- service-role / secret kulcs soha nem kerülhet kliensoldali bundle-be vagy repositoryba.

## 10. Biztonsági eseménynapló

A hardening réteg `security_events` naplót használ. Tipikus mezők:
- időpont;
- felhasználói azonosító, ha ismert;
- eseménytípus;
- súlyosság;
- 0–100 kockázati pontszám;
- IP-cím;
- IP-alapú közelítő ország / régió / város;
- user-agent;
- kért útvonal és HTTP-módszer;
- érintett objektum típusa / azonosítója;
- technikai részletek;
- eseményfingerprint;
- riasztás időpontja;
- megőrzési határidő.

A raw security ledger nem általános felhasználói adatforrás. Normál gazdálkodói vagy szaktanácsadói szerepkör ne kapjon közvetlen SELECT hozzáférést.

## 11. Riasztási és kockázatértékelési modell

A rendszer nem egyetlen hibás próbálkozásra riaszt. A cél a zaj csökkentése és a valóban gyanús minták felismerése.

Példák kockázati jelekre:
- rövid időn belül sok sikertelen bejelentkezés;
- ugyanarról az IP-ről több fiók próbálgatása;
- ugyanarra a fiókra sok különböző IP-ről érkező hibás próbálkozás;
- ismételt jogosultság-megtagadás más gazdaság objektumaira;
- tömeges export vagy backup próba;
- szokatlanul nagy fájlfeltöltési aktivitás;
- tiltott RPC vagy adminútvonal ismételt hívása;
- rövid idő alatt nagy számú, magas kockázatú esemény.

Az admin riasztás küszöbértékhez és mintához kötött. Egyedi hibák naplózódnak, de nem feltétlenül küldenek e-mailt.

## 12. IP-cím és helyadat

Az IP-cím biztonsági incidensvizsgálati adatként naplózható. Az IP-alapú földrajzi hely csak becslés: VPN, mobilhálózat, NAT, szolgáltatói routing és vállalati hálózat miatt eltérhet a valós helytől.

Fontos:
- az IP-cím nem bizonyítja önmagában, hogy melyik konkrét személy hajtotta végre a műveletet;
- jogi eljárás esetén a szolgáltatói naplók és hivatalos adatkérés lehet szükséges;
- az IP-adat személyes adatnak minősülhet, ezért hozzáférése és megőrzése korlátozandó.

## 13. Megőrzés és adatminimalizálás

Alap biztonsági naplómegőrzés: 90 nap. Tényleges incidenshez kapcsolódó rekord külön incidenskezelési döntés alapján hosszabb ideig megőrizhető, jogi és adatvédelmi követelmények figyelembevételével.

Nem naplózandó:
- jelszó;
- access token / refresh token;
- service-role secret;
- teljes session cookie;
- szükségtelenül teljes kérésbody, ha személyes vagy üzleti titkot tartalmaz.

## 14. Incidenskezelés

Magas vagy kritikus riasztás esetén javasolt folyamat:
1. esemény és kapcsolódó IP/fiók/időablak azonosítása;
2. kapcsolódó security_events lekérése;
3. érintett felhasználói sessionök és jogosultságok ellenőrzése;
4. szükség esetén jelszócsere / session visszavonás / ideiglenes hozzáférés-korlátozás;
5. export-, dokumentum- és auditnaplók ellenőrzése;
6. érintett adatok körének meghatározása;
7. bizonyítékok megőrzése;
8. szükség esetén adatvédelmi és jogi incidensfolyamat elindítása.

## 15. Fejlesztési biztonsági szabály

Minden új funkció implementációjánál kötelező security check:
- új tábla → RLS és policy ellenőrzés;
- új RPC → EXECUTE és SECURITY DEFINER audit;
- új fájlfunkció → Storage policy audit;
- új user input → validáció és XSS ellenőrzés;
- új export → jogosultság + auditnapló;
- új adminművelet → objektumszintű authorization;
- új külső szolgáltatás → secret és CSP ellenőrzés;
- a technikai biztonsági dokumentáció szükség szerinti frissítése.

## 16. Maradó kockázatok

A rendszer hardening után sem tekinthető támadhatatlannak. Maradó kockázat például:
- ellopott vagy adathalászattal megszerzett felhasználói hitelesítő adat;
- null-day sérülékenység egy függőségben vagy platformszolgáltatásban;
- kompromittált adminfiók;
- hibás infrastrukturális vagy DNS-beállítás;
- rosszul kezelt külső titok / API-kulcs;
- social engineering.

A védelem ezért rétegzett: authentikáció + RLS + szerveroldali authorization + inputvalidáció + biztonsági headerek + naplózás + riasztás + audit + mentések.
