# Agrár Mentor – hogyan védjük az adatokat? Közérthetően

Az Agrár Mentorban egy gazdaság napi működéséhez tartozó értékes adatok lehetnek: gazdaságok, földtáblák, szemlék, teendők, műveletek, dokumentumok, elérhetőségek és szakmai megjegyzések. Ezeket nem egyetlen „zárral”, hanem több, egymástól részben független védelmi réteggel védjük.

Fontos: nincs olyan internetes rendszer, amelyről felelősen kijelenthető, hogy soha nem törhető fel. A cél az, hogy az Agrár Mentor ne legyen könnyű célpont; egyetlen megszerzett jelszó vagy egyetlen programhiba lehetőleg ne legyen elég az adatok megszerzéséhez, a gyanús próbálkozásoknak pedig maradjon nyoma.

## 1. A jelszó önmagában már nem elég

A rendszerbe történő belépéshez két külön bizonyítékot kérünk. Az első a jelszó. A második egy authenticator alkalmazás által folyamatosan változtatott, 6 jegyű kód.

Első beállításkor a telefonon például Google Authenticator, Microsoft Authenticator vagy más kompatibilis alkalmazás párosítható egy QR-kóddal. Ezután belépéskor a jelszó mellett az alkalmazás aktuális kódjára is szükség van.

Ennek az a lényege, hogy ha valaki megszerzi a jelszót, azzal még ne kapja meg automatikusan a gazdaság adatait.

## 2. A kétlépcsős védelem nem csak egy plusz képernyő

Fontos különbség, hogy nem pusztán a weboldal mutat egy második kódbeviteli oldalt. A fontos üzleti adatoknál maga az adatbázis is ellenőrzi, hogy a második hitelesítési lépés valóban megtörtént-e.

Ez olyan, mintha az épület bejáratánál lenne egy ellenőrzés, de a páncélterem ajtajánál is lenne egy második. Ha valaki technikailag megpróbálja megkerülni a normál weboldalt és közvetlenül az adatbázist kérdezgeti, a második hitelesítés hiányában ott is meg kell állnia.

## 3. Nem elég bejelentkezni – azt is ellenőrizzük, ki mit láthat

Ha két gazdálkodó használja az Agrár Mentort, az egyik nem láthatja a másik földjeit, szemléit, teendőit vagy dokumentumait csak azért, mert tudja vagy kitalálja azok azonosítóját.

Minden felhasználónak szerepe és jogosultsága van. A szerver és az adatbázis is ellenőrzi, hogy az adott ember az adott konkrét gazdasághoz, földtáblához vagy dokumentumhoz hozzáférhet-e.

## 4. A fontos döntéseket nem bízzuk a böngészőre

A saját telefonon vagy számítógépen futó böngésző által küldött adat manipulálható. Ezért az érzékeny műveleteknél a szerver újra ellenőrzi, hogy a felhasználó valóban be van-e jelentkezve, megtörtént-e a második hitelesítés, milyen szerepkörrel rendelkezik, hozzáférhet-e a konkrét gazdasághoz és megfelelő-e a beküldött adat.

Vagyis nem elég, ha a böngésző azt állítja: „nekem ehhez van jogom”.

## 5. A gazdaságok adatai adatbázisszinten is el vannak választva

Az egyik legfontosabb védelmi réteg az RLS. Közérthetően ezt úgy lehet elképzelni, mintha az adatbázis minden adatsora előtt lenne egy biztonsági őr.

Minden kérésnél megvizsgálja: „ennek az embernek ehhez a konkrét adathoz van joga, és megfelelő szinten hitelesítette magát?” Ha nem, az adatot nem adja oda még közvetlen API-hívás esetén sem.

## 6. A teljes adatmentéshez még egyszer igazolni kell magunkat

A teljes backup/export különösen érzékeny funkció, mert nem egyetlen adatlapot, hanem egyszerre nagy mennyiségű adatot képes kiadni.

Ezért itt még az sem elég, hogy valaki már kétfaktorosan belépett. A teljes mentés előtt újra meg kell adnia az authenticator aktuális kódját.

Ennek gyakorlati jelentősége például egy nyitva hagyott számítógépnél vagy ellopott böngésző-munkamenetnél van: attól, hogy valaki hozzáfér egy már megnyitott rendszerhez, még ne tudja egyetlen kattintással letölteni a teljes ügyfélállományt.

A sikeres újrahitelesítés után kapott exportengedély csak körülbelül 5 percig él, csak a mentési műveletre használható, és sikeres export után törlődik.

## 7. A titkos technikai kulcsokat külön kezeljük

Az alkalmazás működéséhez vannak olyan technikai kulcsok, amelyekkel nagyon magas jogosultság érhető el. Ezeket nem adjuk oda a böngészőnek, nem tesszük publikus JavaScriptbe, és nem szabad őket a forráskódba beégetni.

A teljes export rövid engedélyének aláírásához és a biztonsági napló szerveroldali kezeléséhez használt titkok csak a szerveren lehetnek jelen.

A biztonsági naplóba sem mentünk jelszót, authenticator-kódot, teljes belépési tokent vagy titkos API-kulcsot.

## 8. A biztonsági naplót sem írhatja akárki

A gyanús eseményeknek külön biztonsági naplóban maradhat nyomuk. Ezt a naplót azonban maga a normál felhasználói fiók nem írhatja és nem olvashatja szabadon.

A biztonsági események rögzítése szerveroldalon történik egy külön, erős jogosultságú technikai kapcsolaton keresztül. Ennek célja, hogy egy megszerzett gazdafiókkal ne lehessen egyszerűen hamis biztonsági eseményeket gyártani, a naplót teleszemetelni vagy annak tartalmát közvetlenül manipulálni.

## 9. A feltöltött képek és dokumentumok is védett adatok

Egy szemlefotó, videó vagy gazdasági dokumentum ugyanolyan érzékeny lehet, mint egy adatbázis-bejegyzés. Ezért ellenőrizni kell, ki tölthet fel és ki tölthet le fájlt. Egy idegen gazdaság felhasználója ne szerezhesse meg a fájlt pusztán a fájlnév vagy elérési út kitalálásával.

A feltöltéseknél méret- és fájltípus-ellenőrzés is szükséges.

## 10. A böngészőt is védekezésre kérjük

Az Agrár Mentor speciális biztonsági HTTP fejléceket használ. Ezek többek között segítenek abban, hogy más weboldal ne tudja észrevétlenül saját oldalába beágyazni a rendszert, a böngésző ne találgasson veszélyes módon fájltípusokat, HTTPS kapcsolatot használjon, idegen oldalak kevesebb információt kapjanak, és a kamera/GPS csak indokolt helyen legyen elérhető.

## 11. Figyeljük a gyanús viselkedést

Nem minden kattintást „figyelünk”, hanem a biztonság szempontjából fontos eseményeket naplózzuk. Ilyen lehet sok sikertelen belépés, hibás authenticator-kódok sorozata, más gazdaság adatainak ismételt megnyitási kísérlete, tiltott adminfunkciók hívása, friss MFA nélküli exportpróba, sok exportkísérlet vagy sok tiltott művelet ugyanarról az IP-címről.

## 12. Nem egyetlen hibára riasztunk

Egy elgépeléstől senkit nem tekintünk támadónak. A rendszer inkább mintákat keres. Sok egymást követő, hasonlóan gyanús esemény magasabb kockázati értéket kaphat, és indokolt esetben adminriasztás vagy e-mail értesítés készülhet.

## 13. Mit rögzíthetünk egy gyanús eseménynél?

Rögzíthető például az időpont, IP-cím, kapcsolódó felhasználói fiók, próbált művelet, érintett oldal/funkció, böngésző vagy eszköz jellemzője, kockázati besorolás, valamint IP alapján közelítő ország, régió vagy város.

Az IP-alapú hely nem GPS. VPN, mobilinternet, NAT vagy szolgáltatói hálózat miatt eltérhet a valós helytől. Az IP-cím önmagában azt sem bizonyítja, hogy pontosan ki ült a számítógép előtt.

## 14. Ha valaki mégis bejutna, korlátozni próbáljuk a kárt

A védelem nem csak a bejáratról szól. Ha egy jelszó, munkamenet vagy funkció mégis kompromittálódik, abból ne következzen automatikusan az egész rendszer elvesztése.

A védelmi rétegek ezért egymás mögött állnak: jelszó, authenticator-kód, adatbázis szintű másodikfaktor-ellenőrzés, szerepkörök, gazdaságonkénti jogosultságok, szerveroldali ellenőrzések, fájlvédelem, külön export-újrahitelesítés, védett biztonsági napló és riasztási rendszer.

## 15. Mennyi ideig őrizzük a biztonsági naplót?

A normál biztonsági eseményeket jelenlegi terv szerint alapértelmezetten körülbelül 90 napig őrizzük. Valódi incidenshez kapcsolódó események indokolt esetben, a jogi és adatvédelmi követelmények figyelembevételével hosszabb ideig megőrizhetők.

## 16. Mi történik egy komolyabb biztonsági eseménynél?

A vizsgálat során összevethető az időpont, fiók, IP-cím, érintett funkció, export- és dokumentumműveletek, valamint a kapcsolódó biztonsági események. Szükség esetén visszavonhatók munkamenetek, jelszócsere kérhető, korlátozható a hozzáférés, megőrizhetők a bizonyítékok, és elindítható a szükséges adatvédelmi vagy jogi incidensfolyamat.

## 17. Amit szándékosan nem ígérünk

Nem állítjuk, hogy az Agrár Mentor feltörhetetlen. Adathalászat, ellopott eszköz, újonnan felfedezett szoftverhiba, kompromittált adminfiók vagy külső szolgáltatói probléma minden internetes rendszernél maradó kockázat.

Amit viszont megteszünk: nem egyetlen védelmi mechanizmusra támaszkodunk; a jogosultságokat adatbázisszinten is ellenőrizzük; a kritikus műveleteket szerveroldalon ellenőrizzük; kétfaktoros hitelesítést használunk; a teljes export előtt friss újrahitelesítést kérünk; a titkos kulcsokat elválasztjuk a publikus alkalmazástól; a gyanús eseményeket védett naplóban rögzítjük; és az új funkciókat biztonsági szempontból is felülvizsgáljuk.

## 18. Röviden: több ajtó, több külön zár

A legegyszerűbb hasonlat szerint nem egyetlen ajtó védi az adatokat.

Az első ajtó a jelszó. A második az authenticator-kód. A következőnél az adatbázis megnézi, hogy az illető tényleg ehhez a gazdasághoz tartozik-e. A teljes adatmentés előtt pedig még egyszer elkérjük a friss authenticator-kódot. Ha valaki gyanúsan próbálkozik, annak nyoma marad egy olyan naplóban, amelyet normál felhasználó nem tud szabadon átírni.

A cél az, hogy a normál gazdálkodónak és szaktanácsadónak a rendszer használható maradjon, miközben a háttérben több, egymást erősítő biztonsági réteg védi az adatokat.