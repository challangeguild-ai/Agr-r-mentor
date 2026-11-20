# AgrárMentor 2.1 – záró stabilitási javítási kör (2026-11-19)

**Hatókör:** a már elfogadott funkciók hibajavítása a #59 Draft PR ágán, az arculat módosítása nélkül. **Nincs éles Supabase-migráció, Edge Function-telepítés, PR-összevonás vagy Vercel Production deploy.**

## Kiindulási állapot

- A helyi `fix/eight-layer-audit` és a Draft PR távoli ága eltérő commitazonosítókat tartalmazott, de a teljes fájltartalmuk egyezett (`git diff HEAD origin/fix/agrar-mentor-21-wizard-ux-hardening` üres).
- A 225 meglévő automatikus teszt átment. A teljes build mégis megszakadt, mert az előzőleg félretett, eredeti Supabase Edge Function-mentések (`docs/rollback/**`) bekerültek a Next.js TypeScript-ellenőrzésébe.
- Az `npm run lint` egyáltalán nem indult el: hiányzott az ESLint 9 konfiguráció.
- A helyi projekt nem tartalmazott valódi Supabase-környezeti változókat; a build ezt követően csak nem működő, tesztcélú URL-lel és publikus kulcshelyőrzővel futtatható. Valódi hozzáférési kulcsot nem másoltunk a repo-ba.

## Elvégzett javítások

1. **Kiadás előtti fordítás:** a rollback-snapshotok kimaradnak a Next.js typecheckből; a fájlok érintetlenül megmaradnak.
2. **Statikus ellenőrzés:** ESLint 9 és a telepített Next.js 15 szabályok használhatók; az új, explicit fejlesztői függőség a csomagzárban is szerepel.
3. **Diagnosztikai végpontok:** `/api/uksup-health` és `/api/nebih-public-meta` külső forráslekérései csak hitelesített, MFA-val belépett rendszeradminisztrátor számára indulhatnak el. A felületek nem használják közvetlenül ezeket a végpontokat.
4. **Rendszermentés:** sikeres export után a friss TOTP-megerősítő sütit pontosan azon az `/admin/backup` útvonalon járatjuk le, amelyen létrejött. Hálózati hiba után az exportgomb ismét használható és konkrét üzenetet ad.
5. **Térképes biztonság:** a FieldMapEditor problémagóc-címe és -leírása, valamint a FieldsOverviewMap buborékcíme HTML-escape-et kap a Leaflet által HTML-ként értelmezett tartalom előtt.
6. **Térkép állapota:** külső térképi modul betöltési hibája nem marad végtelen „Betöltés…” jelzés; a felhasználó hibaüzenetet kap. Az importálási előnézet memoizálása pontos függőséget használ.

**Ellenőrzés:** 230/230 automatikus teszt sikeres; `npm run lint`: 0 hiba, 17 figyelmeztetés (meglévő képhasználati és React-hook javaslatok). A Next.js 15 production build és mind az 53 statikus/útvonal-előkészítési lépés sikerült kizárólag nem működő tesztkörnyezeti helyőrzőkkel. A hook-jelzéseket nem „javítottuk” általános függőségtömb-átírással, mert a térképszerkesztés és a piszkozatmegőrzés állapotát érdemi újrapróba nélkül felboríthatná.

## Éles környezet: csak olvasásos ellenőrzés

- Supabase: az éles projekten továbbra is az öt előkészített migráció előtti állapot fut; egy `update_own_profile` anonim `SECURITY DEFINER` végrehajtási figyelmeztetését az **előre elkészült** `20261119093000_authorized_advisor_notifications.sql` szigorítja majd. Az autentikált `SECURITY DEFINER` RPC-figyelmeztetéseket nem szabad pusztán a linter alapján visszavonni, mert a folyamatok jogosult hívói ezeket használják.
- A `weather_sync_runs` táblán a policy nélküli RLS szándékos, a hozzáférés szolgáltatói szerepre korlátozott. A teljesen használaton kívülinek jelentett indexeket csekély éles adatmennyiség mellett nem töröltük bizonyíték nélkül.
- Vercel: a javítóág legújabb Preview telepítése READY; a 7 napos lekérdezés nem adott összesített runtime hibát, de ez nem helyettesíti a belépett szerepkörös próbát és nem bizonyítja, hogy minden útvonalat használtak.

## Kiadási kapuk – változatlanul nyitva

1. A felhasználó gépén már sikeresen visszaállított teljes SQL-mentés megőrzése (és külön biztonságos második másolat); két Storage-objektum külön mentve.
2. Az öt függő SQL-migráció helyi, visszaállított klónon történő tranzakciós kipróbálása, majd csak jóváhagyással a megfelelő Supabase célen történő alkalmazása.
3. A három előkészített Edge Function telepítése és az `APP_PUBLIC_ORIGIN` / Auth redirect beállítások egyeztetése; az éles Vercel még a régi kódot szolgálja ki.
4. Izolált tesztadatokkal gazda–munkatárs–szaktanácsadó–admin E2E, meghívó/e-mail, GPS/fotó, táblahatár, növényvédelmi és HungaroMet-próba. A jelenlegi Preview ugyanazt az éles Supabase-hátteret használhatja, ezért nem hajtunk végre próbaadat-írást rajta ellenőrizetlenül.
5. Külön jóváhagyás a Draft PR összevonásához és a Production élesítéshez. **Csak ezután következik a felület egységes arculati köre.**

**Izolált, visszagörgethető migrációpróba előkészítve:** a Windows PowerShell 5.1-kompatibilis `scripts/Test-AgrarMentor-Migrations.ps1` az öt migrációt a **kifejezetten megnevezett, korábban visszaállított** helyi Docker-konténerbe másolja. A `scripts/verify_staged_migrations.sql` egyetlen SQL-tranzakcióban létrehozza az új RPC-ket és a táblahatár-javaslatok tábláját, ellenőrzi az RPC-k anon/authenticated/service_role jogosultságát, a táblák RLS/írási jogait, és 61 kvótakéréssel az e-mailes korlát atomikus működését, majd **minden siker esetén is ROLLBACK-kel visszavonja az egészet**. Hiba esetén `ON_ERROR_STOP` miatt a kapcsolat megszakad, így a tranzakció visszagörgetődik. Két automatikus ellenőrzés védi a próbafuttató célpontját, migrációsorrendjét és visszagörgetését. A felhasználó Windows-gépén még **nem futott le** ez a próba, és a script nem éri el az éles Supabase-projektet.

**Értesítési visszaélésvédelem:** a `send-notification-email` az engedélyezett feladó/címzett ellenőrzése után, de még a Resend-hívás előtt szolgáltatói jogosultságú, tranzakciósan zárolt kvótát kér. Egy feladónál legfeljebb 60 küldés/óra és 200 küldés/UTC-nap engedélyezett. Hiányzó migráció vagy kvótaszolgáltatás esetén 503-mal biztonságosan leáll, betelt keretnél 429-et ad. Ez **még nem telepített** védelem, és nem oldja meg önmagában a felhasználói kapcsolat-/eseményalapú címzettellenőrzés vagy az üzleti eseményhez kötött e-mail-idempotencia valamennyi kérdését.

**Ellenőrzés a második javítási csomag után:** 235/235 Node-teszt sikeres, teljes Next.js 15 production build mind az 53 útvonallal sikeres (csak teszt-URL-lel/kulcshelyőrzővel), lint 0 hiba/17 korábban ismert figyelmeztetés. A `send-notification-email` Edge Function és az ötödik migráció Supabase-on még **nem települt**, a tesztkód nem küld valódi e-mailt.

**Megjegyzés:** a forráskódellenőrzés és a sikeres build nem bizonyítja a még nem telepített SQL/RPC- és hálózati integrációk teljes működését.
