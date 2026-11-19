# Agrár Mentor 2.1 – wizard és UX javítások: ellenőrzési terv

## Változások
- A szaktanácsadói **egyszerű teendő** űrlap farmfüggő földtábla- és munkatársválasztóval, alapértelmezett tulajdonossal, opcionális táblával, dupla kattintás elleni zárral és siker/hibavisszajelzéssel működik. Értesítési hiba esetén a feladat létrejöttét külön jelzi, nem kéri az egész művelet újraküldését.
- A teendő határidejét a szerver valódi naptári dátumként ellenőrzi (például a február 30. érvénytelen).
- A végrehajtás szaktanácsadói jóváhagyása/elutasítása után az értesítés hálózati hibája nem dobja vissza a már adatbázisban rögzített szakmai döntést.
- Opcionális, ingyenes **tömeges földtábla-import** a szaktanácsadói „Táblaimport” menüpontból (GeoJSON, SHP ZIP). Gazdaság választása, legfeljebb 50 kijelölt táblahatár, szerkeszthető név, alakhelyes vázlat, duplikációellenőrzés, közös adatbázis-mentés. Nem hivatalos földhivatali adat; nem igényel HRSZ-t.
- A tömeges import kiválasztott táblája **műholdas/utcatérképes, valós földrajzi előnézeten** látszik mentés előtt (MultiPolygon és lyukak is). Az eseti koordinátasorrend-hibára térségi figyelmeztetés hívja fel a figyelmet, hálózati térképhiba esetén marad az alakvázlat.
- A tömeges import **ismételt beküldése** pontos név+geometria-egyezés esetén nem készít új rekordot, akkor sem, ha a poligongyűrű más töréspontnál kezdődik vagy fordítva járja körül a határt. A szerver csak a hiányzó sorokat hozza létre egy közös INSERT-ben; eltérő nevű vagy határú ütközések tiltottak. Párhuzamos, egymásnak ellentmondó importok ellen adatbázis-szintű egyediség még nem garantált.
- A Leaflet összesített térkép HTML-ablakai immár escape-elik a feltöltésből érkező tábla- és farmneveket. A hétvégi kézi rendszerpróba itt még nem történt meg.
- A meghívók URL-je nem a korábbi Vercel-címet használja, hanem az ellenőrzött `APP_PUBLIC_ORIGIN` változót.
- A `invite-farmer` Edge Function csak az adott origin pontos `/invite` útvonalát engedi át.
- A gazdálkodói műveleti wizard lépésenként ellenőrzi a földtáblát, dátumot, készítményt, kultúrát, felhasználást, dózist, jogosultságot, területet és gépadatot.
- A korábban elrejtett, kötelező mezők nem blokkolják némán az utolsó lépést; a wizard saját ellenőrzést használ.
- Piszkozatmentés: **sessionStorage**, azonos felhasználóhoz kötött kulccsal, legfeljebb 12 órán keresztül; nem kerül adatbázisba, új böngészőlapon nem érhető el.
- A munkatársmeghívó wizard a szerverhibákat a felületen mutatja, és siker esetén megerősítést ad.
- A dashboard valódi állapotneveket használ, nem előre beállított 60%/80% értékeket.
- Egységesebb wizard-tipográfia, 44px-es vezérlők, látható fókusz és olvashatóbb mobilos dashboard.

## Kötelező üzembe helyezési lépések
1. A jelenlegi, valódi *éles* frontend-domaint azonosítani kell. A korábbi `agr-r-mentor.vercel.app` **nem használható automatikus alapértékként**.
2. Vercelben Production esetén `APP_PUBLIC_ORIGIN=https://<aktualis-domain>`; Preview környezetben csak a tényleges preview origin.
3. A Supabase `invite-farmer` Edge Function környezetében **ugyanezt az eredetcímet** kell felvenni `APP_PUBLIC_ORIGIN` néven; az Edge Function új forrását külön telepíteni kell.
4. Supabase Authentication → URL Configuration → Redirect URLs: a **pontos** `https://<aktualis-domain>/invite` címet kell engedélyezni. A Site URL-t is ellenőrizni kell.
5. Ellenőrizni kell az éles Supabase- és Vercel-konfigurációkat; titkok nem kerülhetnek forráskódba.
6. Az új kódot csak build + jogosultsági próbák + működő Preview után szabad a 2.1 ágba vagy productionbe beolvasztani.

## Manuális átvételi forgatókönyvek (még nem végrehajtva)
- Gazdálkodó és szaktanácsadó szerepkörrel külön-külön meghívás: a valódi, aktuális frontend `/invite` oldalára érkezik az e-mail-link.
- Hiányzó/hibás `APP_PUBLIC_ORIGIN`: az alkalmazás egyértelmű hibát ad, nem irányít a régi felületre.
- Növényvédelmi wizard: földtábla nélkül nem enged tovább; hiányzó kultúra/felhasználás/dózis/jóváhagyó esetén érthető üzenetet ad.
- Dózis hivatalos minimum alatt, maximum felett: a wizard és szerveroldal egyaránt tiltja.
- Végrehajtás: terület nagyobb a földtáblánál; negatív mennyiség; meg nem nevezett külső gép → hiba.
- Minden lépés végigjárása után, normál érvényes művelet elmenthető.
- Megszakított wizard ugyanazon lapon frissítés után visszaáll: kiválasztott mezők, szövegbevitelek, lépés; hivatalos katalógus újraellenőrzendő.
- Más felhasználóval nem töltődik be az előző felhasználó piszkozata.
- Sikeres mentés után a piszkozat eltűnik; elvetés után az űrlap tisztán indul.
- Munkatárs-meghívás: hibás e-mail, már függő meghívás, MFA-igény, sikeres meghívás.
- Dashboard: a „Folytasd innen” sorok valódi állapotot mutatnak, nem ál-százalékot.
- Mobil 360/390/768 px és asztali 1280 px: feliratok, fókusz, gombok, kilógás, túra/varázsló átfedés.
- RLS/MFA regresszió: gazdaság más felhasználó nevében nem módosítható, rendszeradmin és szaktanácsadó határa változatlan.

## Automatizált és hiányzó bizonyíték
- `npm run test:invite`: három valós unit teszt a meghívó URL képzésére (Node.js 22).
- A teljes `npm run build`, a teljes rendszer E2E útvonaltesztje, a Supabase éles környezet és a Vercel Preview működése **itt még nem bizonyított**.
- Ez a változáscsomag szándékosan *Draft PR*. Az éles adatbázist és a production környezetet nem módosítja.


## 2026-11-18 – második ellenőrzési kör

- Oktató mód: a scroll/resize esemény már nem görgeti vissza a mezőt újra és újra; az Esc bezárja. Csökkentett mozgás beállítása támogatott.
- Műveleti napló: a lehetetlen naptári dátumot a szerver is elutasítja, a hibás számadatot nem alakítja csendben üres értékké.
- A szakmai katalógus hálózati hibája nem válthat át ellenőrizetlen növényvédelmi műveletrögzítésbe. Újratöltés gomb rendelkezésre áll.
- Hivatalos termékhez érvénytelen/hiányzó felhasználási rekord esetén a wizard megáll.
- A mentés előtti ellenőrző oldalon a dátum, terület, dózis, mennyiség, végrehajtó és körülmények is megjelennek.
- A munkatárs-meghívás a Supabase Edge Function részletes hibaüzenetét felhasználóbarátan továbbítja; részleges meghívás esetén külön figyelmeztet.
- A piszkozat első betöltése egyszeri; a későbbi komponens-frissítés nem írhatja vissza automatikusan a korábbi állapotot.
- A README naprakész állapotjelentést ad az MVP-ről a 2.1-es ágra átállás helyett.

### Tesztek és bizonyítékok

- Helyi Node.js 22: `node --experimental-strip-types --test tests/*.test.mjs` → **7/7 PASS** (meghívási eredetcím, valós naptári dátumok, tizedesértékek).
- A Vercel Preview `success`/Ready buildet jelezhet a commitokra, de ettől az MFA-, RLS- és bejelentkezett UI/E2E-folyamatok nem tekinthetők igazoltnak.
- A teljes hitelesített kézi tesztlista továbbra is kötelező; **éles merge továbbra sincs jóváhagyva**.


### Időjárási adatminőség – 2026.11.18
- A dashboard és a földtábla adatlap ugyanazt a `summarizeStationPrecipitation` függvényt használja.
- A 7/30 nap teljes **naptári nap**, budapesti helyi dátum szerint; a téli-nyári időszámítás váltása nem befolyásolja a napok számát.
- A mérési napok száma megjelenik (pl. `5/7 nap`); a hiányzó adat **nem azonos** a mért 0 mm esővel.
- Azonos táblán, azonos napon több adatforrás-sor nem kerül összeadásra duplán; a legújabb import elsőbbséget kap.
- Regressziós tesztek: 4 új időjárási eset (DST, naphatárok, duplikációk, hiányzó adat), így a teljes Node 22 **11/11 PASS**.
- Továbbra is ellenőrizni kell a tényleges HungaroMet forrásfrissességet és az időjárási Cron adatbázisba írását egy működő jogosult környezetben.


## 2026-11-18 – harmadik kör: növényvédelem és napi munkaközpont

- **Valódi forráshiba javítva:** a `rollingPrecipitation.ts` dátumszűrője hibásan dupla backslash-sel szerepelt a GitHubon, ezért minden naptári dátum kieshetett. A GitHubon javított regex visszaolvasva ellenőrzött.
- **Földtábla- és művelettípus-váltás:** a korábbi termék, kultúra, felhasználás, dózis és gép nem marad észrevétlenül kiválasztva; a releváns mezőket újra ki kell tölteni.
- **Dashboard:** a javításra visszaküldött munka megelőzi az általános folyamatban lévő munkát; ugyanaz a feladat nem jelenik meg kétszer.
- **Növényvédelmi státusz:** az űrlap és a szerveroldali mentés a HU/SK engedély- és felhasználási dátumokat ugyanazzal az előellenőrző modullal vizsgálja. HU ismeretlen státusz, lejárt türelmi idő vagy nem aktív szer blokkol; dokumentált felhasználási türelmi idővel történelmi dátum is kezelhető.
- **Meghívás:** Supabase Edge Function hiányzó caller-redirect esetén is kötelezően az `APP_PUBLIC_ORIGIN` validált `/invite` útvonalát állítja be. Beállított origin nélkül fail-closed.
- **Automatikus helyi tesztek:** 18/18 PASS (Node 22, `node --experimental-strip-types --test tests/*.test.mjs`): URL, dátumok, számok, időjárás, dashboard deduplikálás, engedély-/türelmi idők.
- **Preview build:** a működési forrás legfrissebb ellenőrzött commitja `f0c41199` Vercel `success` státuszú.

**Élesítés előtti megmaradt blokkolók:** Vercel és Supabase aktuális Production URL és Edge env összerendezése; valódi farmer/advisor/admin end-to-end és meghívó e-mail próbák; szükséges Supabase-migrációk és automatikus időjárási Cron ellenőrzése; éles merge külön jóváhagyással.


## 2026-11-18 – negyedik kör: munkakiosztás és mentési stabilitás

- **Műveleti napló jogosultság:** a saját földek mellett az aktív `manager` / `agronomist` gazdaságok is megjelennek. Ez a megjelenítést a meglévő szerveroldali jogosultsági szabályhoz igazítja, és nem ad új jogosultságot.
- **Katalógus újrapróbálása:** azonos földtábla/ország/művelettípus esetén nem törli a beírt adatokat; kontextusváltásnál továbbra is törli az elavult növényvédelmi kiválasztásokat.
- **Munkakiosztás UI:** a gazdaság választása szűri a földtáblát, végrehajtót és gépet; gazdaságváltáskor a régi kiválasztások törlődnek.
- **Munkakiosztás mentés:** több kattintás elleni védelem; mentés alatt állapotjelzés; siker/hiba esetén felületi visszajelzés; érvénytelen határidő elutasítása.
- **Részleges hibák:** a gép hozzárendelésének sikertelenségét a rendszer megkülönbözteti a feladatlétrehozás hibájától, és figyelmeztet az esetleges részben létrejött feladat ellenőrzésére. A külön táblákba írás továbbra sem tranzakciós, ezt hosszabb távon DB-oldali atomikus műveletté érdemes átalakítani.
- **Kódfordítás:** a munkakiosztó új komponensének első bekötésekor az eredeti munkalistában még használt `machineTypeLabel` import hiányzott; reprodukció és célzott helyreállítás után az új felületet ismét bekapcsoltuk.
- **Automatizált helyi tesztek:** 21/21 sikeres Node 22 teszt; 3 új eset a gazdaságfüggő mezők szűrésére, az ismeretlen gazdaságra és a gazdaságváltásra.
- **Vercel státusz:** a legutóbbi működési kód commitja `2e958d62` sikeres `success` buildet kapott, a felületet bejelentkezett felhasználóval még nem ellenőriztük.

### Kiadási figyelmeztetés
A sikeres Vercel-build **nem** jelenti a teljes működő szerveroldali jogosultság és a Supabase integráció végigtesztelését. A PR maradjon Draft, az éles Supabase környezetet és a production domaint nem módosítottuk.


## 2026-11-18 – ötödik ellenőrzési kör: félbemaradt műveletek, részleges kiosztás

- **Piszkozat visszaállítás:** a korábban elmentett uncontrolled beviteli mezők visszatöltése végéig nem írjuk felül a snapshotot az űrlap kezdeti értékeivel.
- Az üresen megnyitott új űrlap nem hoz létre hamis piszkozatot; a saját, érvényes, legfeljebb 12 órás kitöltés visszaállítható.
- Lejárt, jövőre dátumozott, sérült, váratlan típusú, jogosulatlan földtáblára mutató vagy más művelethez tartozó böngészős snapshot nem tölthető vissza.
- A folyamat közben hibára futott növényvédelmi katalógus betöltése **nem törli az eredeti snapshotot**; a kézi újratöltés után állítható vissza. A katalógusból kikerült termék / felhasználás nem marad érvényesként kijelölve.
- **Munkakiosztás részleges siker:** a feladat sikeres létrehozása után a géphozzárendelés / napló / belső értesítés / e-mail részleges hibáját a rendszer figyelmeztetésként közli, nem újraküldésre ösztönző általános hibaként. Az esetleges hálózati kivételeket a segédműveletek külön kezelik.
- **Valós státuszok:** a munkakiosztó „Kiosztva”, „Folyamatban”, „Ellenőrzésre vár”, „Javításra visszaküldve”, „Elvégezve” értékeket különböztet meg. A váratlan adat nem jelenik meg hamisan kiosztottként.
- További ellenőrzések: 4 új böngészős piszkozat-regressziós eset + 3 új státuszregressziós eset. Ezek különálló Node 22 másolaton **7/7 PASS** eredménnyel lefutottak. A repository teljes 28 tesztjének közös újrafuttatása ebben a környezetben nem történt meg; a korábbi 21 teszt korábbi futási eredmény.
- A legutolsó működési kód commitja: `53f62fef` — a GitHub kombinált Vercel-státusza **success**.

### Maradó, nem elvégzett ellenőrzés
1. Bejelentkezett gazdálkodó és agronómus: művelet félbehagyása / ugyanazon lap újratöltése / termék kivonása a katalógusból / adatok beküldése.
2. Munkakiosztás: gépkiosztási részhiba után a feladat csak egyszer létezik, és a felületi figyelmeztetés megjelenik.
3. A Vercel Preview a tényleges Supabase-sémával, RLS/MFA- és hivatalos-katalógus-hozzáférésekkel együtt működik.
4. Éles Vercel/Supabase domain, `APP_PUBLIC_ORIGIN`, Edge Function, Auth redirect URL és HungaroMet időjárási cron konfigurációja ellenőrzött.
5. Teljes GitHub tesztcsomag és valódi böngészős ellenőrzések után külön merge/élesítés jóváhagyása.

A tesztág **nem** módosítja a production adatbázist vagy az éles honlapot.


## 2026-11-18 – hatodik ellenőrzési kör: szerveroldali megfelelőség és build-kapu

- A `package.json` build-parancsa immár `npm test && next build`; a Preview sikeres buildje ezért a Node 22 regressziós tesztek futását is megköveteli.
- **Szerveroldali kiskapu bezárva:** növényvédelmi műveletet nem lehet kézi készítménynévvel beküldeni a hivatalos `product_id` kihagyásával, ha az adott országban aktív hivatalos terméktörzs létezik. Ha nincs aktív hivatalos termék, kézi bejegyzés csak megadott készítménynévvel fogadható el; az nem jelölhető hivatalos engedélyezett felhasználásnak.
- **Gazdálkodói művelet:** ha a `field_operations` sor létrejött, de az idővonal későbbi írása hibázik, a rendszer a létrejött műveletet részleges sikernek tekinti, a felületen figyelmeztet, és nem kínál ismételt mentést a duplikáció veszélyével.
- **Szaktanácsadói terv:** valós naptári dátum, szigorú tizedesbevitel, az engedély hatálya / HU visszavonási felhasználási türelmi idő, jogosult gazdasági jóváhagyó és jogosultsági kategória szerveroldali ellenőrzése.
- **Szaktanácsadói terv UX:** lejárt vagy nem alkalmazható készítmény a tervben még mentés előtt látható hibát kap. A már létrehozott feladat és terv utáni opcionális napló-, gép- és értesítési hibák külön figyelmeztetések, nem duplikálásra késztető általános hibák.
- **Katalógus jogosultság:** gazdaságspecifikus engedély- és jóváhagyói adatokhoz a gazdaságtulajdonos, aktív gazdaságvezető vagy agronómus férhet hozzá; szaktanácsadó esetén továbbra is a DB RLS-sel látható gazdaságok körére korlátozott az elérés.
- **Jóváhagyók egységes szabálya:** a két űrlap közös jogosultsági helperével és négy regressziós teszttel az I/II kategória szabályai konzisztensen jelennek meg. A segédfüggvény közvetlen szerveroldali importja a buildet hibára vitte; a két szerver action ezért egyelőre a korábbi, velük funkcionálisan egyenértékű inline ellenőrzést használja, amíg a konkrét buildhiba diagnózisa el nem készül.
- **Automatikus tesztek:** összesen 34 egyedi `test(...)` eset van tíz `.test.mjs` fájlban. A Vercel Preview  `654e6dd6` commitjának `success` státusza a kötelező tesztparancsot tartalmazó build mellett igazolt.
- Ez build- és célzott regressziós tesztbizonyíték, **nem** jogosult felhasználóval végzett Supabase adatbázis E2E-próba.

### További kiadási kapuk
1. Valós gazdálkodói és szaktanácsadói E2E-teszt: aktuális gazdaság/jogosultság, katalógus, engedély-, jóváhagyó-, művelet- és tervmentés.
2. Részleges írások adatbázis-tranzakciós/idempotens kezelése Supabase oldalon későbbi tervezett feladat; az aktuális figyelmeztetések a felhasználó újrakattintásából eredő duplikáció kockázatát csökkentik, **nem** adnak teljes szerveroldali idempotenciagaranciát.
3. Valódi meghívó e-mail, `APP_PUBLIC_ORIGIN` és Supabase Auth allowlist, Edge Function, HungaroMet Cron, MFA/RLS integráció.
4. Az utolsó dokumentációs commit Preview-buildjének sikeres ellenőrzése, és csak később külön merge-jóváhagyás.

Az éles app, Supabase adatbázis és production domain nem módosult.


## 2026-11-19 – hetedik kör: tervezési határok és időpontfüggő jogosultság

- A növényvédelmi jóváhagyó engedélyének nemcsak ma, hanem a jövőbeli tervezett kijuttatás napján is érvényesnek kell lennie. A szaktanácsadói űrlap ugyanígy szűri a választható személyeket.
- A gazdálkodói művelet regisztrálásakor és jóváhagyásakor az engedély lejárata a **budapesti naptári nap** szerint értendő, nem UTC-nap szerint.
- A szaktanácsadói terv szerveroldalon csak ismert művelettípust fogad el, a tervezett terület nem lehet nulla/negatív, és a terület nem lépheti túl a kiválasztott földtábla méretét.
- Csak **aktív, ugyanahhoz a gazdasághoz tartozó** gépet lehet feladathoz rendelni. A gépválasztó földtáblaváltáskor törli a korábbi gépet; a területbeviteli mező az új tábla területét ajánlja fel.
- A tiszta validációs függvényekhez 3 új regressziós teszt került: engedély érvényessége a tervezett időpontig, sérült engedélydátum, területhatárok. Összesen **37 Node teszteset** szerepel a projektben.
- A legutolsó módosított tesztfájlt helyi Node.js 24 környezetben ellenőriztük: **7/7 PASS**. A teljes tesztcsomagot a Vercel Preview npm test && next build kapuja futtatja.
- A kapcsolt „Agrár mentor” Supabase projekt 2026.11.19-én **INACTIVE** állapotú volt; nem indítottuk el. Ezért az aktív adatbázisra irányuló lekérdezést, RLS/MFA-integrációt és többfelhasználós E2E-t külön kell igazolni.

**A #59-es PR továbbra is Draft; nem történt production merge, domain-változtatás vagy adatbázis-írás.**


## 2026-11-19 – nyolcadik kör: végrehajtási igazolások és hibás beküldés utáni fotómegőrzés

- **Kritikus fotómegőrzési kockázat:** a telefonos felület korábban minden szerveroldali hibára törölte az újonnan feltöltött bizonyító fényképet. Ha az adatbázis-függvény közben mégis eltárolta a végrehajtást, a napló bejegyzése törölt fájlra mutathatott.
- Az írási kísérletet a szerver explicit jelzi. A kliens csak igazoltan a DB-művelet előtti elutasítás esetén távolítja el a feltöltést. Hálózati bizonytalanságnál megőrzi a fotót és a feladatlista ellenőrzését kéri, mielőtt újraküldés történne.
- Már beküldött vagy lezárt feladat ismételt beküldési kísérlete nem hoz létre második végrehajtási riportot; az új, feleslegesnek bizonyult feltöltést a kliens eltávolítani próbálja.
- Sikeres DB-beküldést követő értesítési vagy oldalfrissítési hiba nem változtathatja a mentést általános hibává. A munkalépés idővonal-bejegyzése után hibázó tanácsadói értesítés sem ösztönöz újrakattintásra.
- A munkavégzés tényleges dátuma most valós naptári nap, helyi Budapest-dátummal; jövőbeli dátum nem fogadható el. A numerikus bevitel ugyanazt a szigorú tizedes-ellenőrzést használja, mint a műveleti rögzítés.
- Növényvédelemnél a tényleges végrehajtási adat beküldése a közös HU/SK engedélyezési státusz és türelmi idő ellenőrzését is használja. A megadott dózisegységnek meg kell egyeznie a hivatalos egységgel; hiányzó egység nem kerülheti meg a validációt.
- Új regressziós esetek: a fotó csak bizonyított, írás előtti hiba esetén törölhető; sikeres vagy bizonytalan eredménynél megmarad. Helyi Node.js 24: **2/2 PASS**. A projekt összesen **39 Node tesztesetet** tartalmaz.
- **Határ:** a hálózati bizonytalanság nem egyenlő teljes szerveroldali idempotenciával. Az adatbázis-függvény, RLS, GPS/fotó-hozzáférés és többfelhasználós E2E valós Supabase-környezettel továbbra is ellenőrizendő.

**A #59-es PR Draft marad; sem éles merge, sem adatbázis-migráció nem történt.**


## 2026-11-19 – kilencedik kör: valós táblahatár-geometria és helyrajzi szám

- Az Agrár mentor Supabase projektet a felhasználó újraaktiválta; 2026.11.19-én a projekt `ACTIVE_HEALTHY` státusza és a `fields` tábla sémája **csak olvasással** ellenőrzött. Hét tábla mindegyikén `Polygon` geometria van; hat táblán van HRSZ. A hét határgyűrű mindegyike hat koordinátát (öt önálló töréspontot + zárópontot) tartalmaz, ezért nem tekintjük őket önmagukban hivatalosan ellenőrzött határnak. A `geometry_source` minden esetben `manual`.
- A korábbi GPS-határbecslés a legközelebbi csúcs helyett a határ **szakaszait** méri; belső kizárt terület (GeoJSON hole) és MultiPolygon figyelembevétele. Hat új GPS-regressziós teszt sikeres; a `cbb18d3` commit Vercel státusza `success`.
- Pontos GeoJSON import `Polygon`, `MultiPolygon`, `Feature` és egyetlen geometriát tartalmazó `FeatureCollection` bemenetre. Az összes töréspont és belső kivágás megőrződik; nincs automatikus leegyszerűsítés. WGS84-koordinátatartomány, zárt gyűrű, nemnulla terület, méret és elemszám ellenőrzése. EOV/vetületi koordináták téves GPS-ként való kezelése elutasítva. Hét új tiszta regressziós teszt: **7/7 PASS**; összesen **52 Node teszteset**.
- A szaktanácsadói térképen fájlból betöltött geometriát mentés előtt meg kell nézni; új rajzolás/szerkesztés kézi eredetet, fájlimport külső eredetet jelöl. A szerver ugyanazt a geometriavizsgálatot alkalmazza mentéskor. A táblaváltás a térképet újrainicializálja, elkerülve az előző tábla alakzatának megjelenését.
- Kijavított HRSZ-metadatakezelés: a felület korábban `official_cadastral`, `external_api`, `gml_import` értékeket írt volna, noha az éles adatbázis csak `manual`, `cadastral`, `mepar`, `external` értékeket fogad el. A helyrajzi szám puszta mentése most már **nem** írja át a tényleges geometriát és annak forrását.
- **Korlát:** nincs automatikus hivatalos HRSZ → vektoros poligon API a projektben. A Lechner/GeoShop jogszerű adatbeszerzése vagy adatszolgáltatói megállapodása későbbi integráció. A földrészlethatár és a tényleges művelt tábla határa eltérhet. A GeoJSON fájl eredetét/szakszerű vetületi konverzióját a felhasználónak ellenőriznie kell; a strukturális ellenőrzés nem teljes topológiai és jogi hitelességvizsgálat.
- **Nem történt élő Supabase írás, schema migration, production merge vagy domainváltoztatás.** A #59 PR továbbra is Draft; Supabase-be bejelentkezett személyekkel végzett import/mentés E2E még szükséges.


## 2026-11-19 – tizedik kör: választható, részleges táblahatár-felvétel

- **Egyszerű, opcionális adatbevitel:** földtábla létrehozásakor változatlanul csak gazdaság és táblanév szükséges. Terület, kultúra, település/HRSZ és a külön térképi határ nem kötelező. A létrehozás közvetlenül a tábla térképére vezet; egy megjelölt középpont önmagában is menthető.
- **Új, ingyenes és nem hivatalos határjavaslat:** a megjelölt pont közelében OpenStreetMap/Overpass nyilvános szolgáltatást kérdezünk; csak a kattintott pontot ténylegesen tartalmazó, zárt `farmland`, `meadow`, `orchard`, `vineyard` `way` poligonokat ajánljuk fel, legfeljebb ötöt. A javaslatokat kisebb terület szerint rendezzük, de **egyik sem kerül automatikusan mentésre**. A térképen előnézet szükséges, utána külön mentés.
- **Meglévő lehetőségek megmaradnak:** WGS84 GeoJSON-import megőrzi az összes töréspontot és belső kivágást, a kézi rajzolás/szerkesztés továbbra is lehetséges; sikertelen/túl lassú OSM-kérés egyik útvonalat sem akadályozza. A külső geometriaforrás a meglévő adatbázisban `external` értékként szerepel, sémaváltás nélkül.
- **Minőségjelzés:** a felület egyértelműen különbözteti meg a csak ponttal rendelkező és poligonos táblát, valamint figyelmeztet: a kitöltött mezők vagy bevont források száma **nem pontossági mutató**. OSM-lefedettség esetleges; egy mezőgazdasági landuse poligon több tényleges táblát összefoghat. A geometria strukturális ellenőrzése nem hiteles kataszteri vagy topológiai bizonyítás. Az OpenStreetMap adatai ODbL feltételek mellett érhetők el.
- **Teszt:** hat új OSM-geometriateszt (pont/poligon összetartozás, szabálytalan poligon minden pontjának megőrzése, nem zárt útvonal kizárása, hibás adatok, maximum öt javaslat, agrár-kategóriák). A célzott új + GeoJSON tesztcsoport helyi Node 24 környezetben **13/13 PASS**. A teljes projekt most **58 Node tesztesetet** tartalmaz; a Vercel build státuszát külön kell ellenőrizni.
- **Adatbázis read-only:** a visszaaktivált projektben 7 tábla, 7 poligon és 7 középpont volt. Nem történt adatírás, sémaátalakítás, éles merge vagy domain-változtatás. A #59 PR Draft marad.
- **Kiadási kapu:** bejelentkezett szaktanácsadói E2E-próba OSM-eléréssel, CORS/szolgáltatási korlátokkal, poligon mentése/újranyitása és GPS-ellenőrzés tesztelése; OSM ODbL-megfelelés ellenőrzése adatpublikálás előtt.


## 2026-11-19 – tizenegyedik kör: díjmentes, saját táblahatárfájlok használata

- A táblahatár funkcióhoz **nem követelünk meg fizetős földhivatali adatszolgáltatást**. A korábban elkészített vagy jogszerűen beszerezhető gazdálkodói téradatok opcionálisak; a pont, az ingyenes OSM-javaslat és a kézi rajzolás továbbra is elérhető.
- A szaktanácsadói térképszerkesztő már GeoJSON mellett **ZIP-be csomagolt ESRI Shapefile** fájlt is kiválaszthat. A `.shp`, `.shx`, `.dbf`, `.prj` együttesét kéri, a konverziót a böngészőben, a nyílt forrású és MIT-licencű `shpjs@6.2.0` modullal végzi; a modul csak SHP-választáskor töltődik be. Az egész eredeti ZIP-et nem küldjük a szervernek. Külön, megerősített mentéskor az egyetlen kiválasztott WGS84 GeoJSON poligon kerül a meglévő `fields.boundary_geojson` mezőbe.
- Több Shape-réteg vagy sok GeoJSON Feature esetén a felhasználó **külön választ az 1–60 határjelölt közül**; a rendszer nem emel be önkényesen egy poligont. A szerveroldali geometriavizsgálat változatlanul érvényes minden mentésre. Hiányzó vagy hibás geometria, 60 feletti területszám, helytelen GeoJSON-vetület, 2 MB feletti GeoJSON és 8 MB feletti SHP ZIP elutasítást kap.
- A MÁK mobilGAZDA saját területmérési Shape-exportja így megfelelő forrásfájl esetén feldolgozható lehet. Az EOV→WGS84 átalakítás eredményét műholdképen ellenőrizni kell; helyszíni és geodéziai pontosságot nem garantálunk. GML/DXF közvetlen importja továbbra sincs. Régebben megvásárolt hivatalos adatok esetén a felhasználási jogokat külön tisztázni szükséges.
- **7 új teszt** a többpoligonos választásra, Feature/Layer felbontásra, MultiPolygon megőrzésére, hibás/üres bemenetre, rossz EOV GeoJSON CRS-re, elemszámkorlátra és feliratbiztonságra. A célzott Node.js 24 teszt **7/7 PASS**, a teljes projektre becsült összes tesztszám **65**. A Vercel Preview build és a valódi mobilGAZDA SHP ZIP mintával végzett E2E ellenőrzés külön kiadási kapu.
- **Éles Supabase adatbázist nem módosítottuk, új táblát/migrációt nem vezettünk be, nem történt production merge.** A #59 PR Draft marad.


## 2026-11-19 – tizenkettedik kör: földtábla felismerése papírtérképről / PDF-ből

- **Kísérleti, opcionális importút:** a szaktanácsadói `FieldMapEditor` a meglévő OSM/GeoJSON/SHP/kézi rajzolási lehetőségek mellé JPG/PNG/WebP fényképet vagy legfeljebb 10 MB-os PDF-et fogad. A `pdfjs-dist@6.5.438` csak PDF-feltöltéskor töltődik be; az oldalválasztó többoldalas PDF-ben is használható (legfeljebb 50 oldal).
- A fotó/PDF a **böngészőben** képpé alakul; az eredeti dokumentum nem kerül a Supabase Storage-ba, nincs külön fizetős képfelismerő API. A raszter legfeljebb 1800 képpontos legnagyobb oldalra és 3 megapixelre skálázódik.
- A felhasználó a kívánt földrészlet belsejére kattint; a határkövető a sötét zárt vonalakkal határolt terület külső kontúrját keresi, nem végez kötelező OCR-t vagy helyrajziszám-lekérdezést. A sötétvonal-küszöb állítható; nyitott/oldalszélig kifutó, túl kicsi vagy túl nagy találat elutasítást kap.
- **Térképi illesztés:** a dokumentum és a valódi műholdkép közös pontjaiból 3 ponttal affin, 4 ponttal projektív transzformáció számolható. A helyi méteres Mercator-koordinátákból WGS84 GeoJSON készül. A felvitt pontok számozva látszanak a dokumentumon és a térképen; utolsó pont visszavonható. Pont nélkül a rendszer **nem talál ki földrajzi koordinátákat**.
- A felhasználó az eredményt csak **előnézetbe** helyezheti, majd külön ment; a forrás a meglévő `external` érték, nem `cadastral` hitelesítés. A meglévő `saveFieldMap` szerveres geometriavalidáció és csak tanácsadónak engedő RLS változatlan. A felhasználói dokumentum forrását, hitelességét és a ténylegesen művelt területtel való egyezését nem bizonyítjuk.
- Nyolc új tiszta teszt: zárt négyszög + HRSZ-szerű felirat, konkáv L-alakú határ, szomszédos földrészletek különválasztása, nyitott vonal elutasítása, halvány nyomat küszöbe, 3 pontos affin, 4 pontos projektív és degenerált pontok elutasítása. Teljes projekt: **73 Node-teszt**.
- **Korlátok/kiadási kapu:** nincs OCR-alapú HRSZ automatikus keresés, országos kataszteri georeferenciáló szolgáltatás, geometriai pontossági garancia vagy közvetlen gazdálkodói adatbázis-mentési jogosultság. Valódi földhivatali térképmásolatos, mobilos PDF/fotós, bejelentkezett tanácsadói mentés/újranyitás E2E és Supabase RLS még külön ellenőrzendő. Éles adatbázis, production vagy migráció érintetlen.


## 2026-11-19 – táblahatárok előzetes minőségellenőrzése

- A gazda rajzolás, fájlimport vagy OSM-javaslat után a mentési gomb előtt **becsült hektárt, töréspontszámot és figyelmeztetéseket** lát. A csak helypontból álló felvétel megmarad; nem mutatunk megtévesztő pontossági százalékot.
- A megadott hektárhoz képest jelentős geometriai eltérés, a korábban mentett helyponttól nagy távolság és egy már létező poligon pont-only javaslattal való lecserélése külön jelzést kap. Ezek **tanácsadói ellenőrzési javaslatok**, nem automatikus elutasítások.
- A szaktanácsadói jóváhagyó oldal további, ugyanazon gazdasághoz tartozó legfeljebb 50 poligonon keres lehetséges átfedést. A geometriai heurisztika megkülönbözteti a közös mezsgyét a valódi területi átfedéstől; kezeli a MultiPolygon részeket és a belső kivágásokat. Túl bonyolult vagy hiányos ellenőrzés esetén jelzi a bizonytalanságot. Nem helyettesíti a PostGIS/geodéziai topológiai igazolást.
- Az admin **Határellenőrzés** oldal 50-es lapokon mutatja a hiányzó/pontra korlátozódó/gyanús régi földtáblákat, ahonnan közvetlenül nyitható a szaktanácsadói térképszerkesztő. Az áttekintő számlálók az éppen betöltött lapra vonatkoznak.
- **Kiadási kapu:** valós térképi adatokkal, eltérő méretű és több részből álló táblákkal, gazda/szaktanácsadó jogosultságokkal végzett hétvégi kézi próba. Sem a figyelmeztetés, sem az előzetes tesztek nem jelentik a jogi táblahatár hitelesítését.
