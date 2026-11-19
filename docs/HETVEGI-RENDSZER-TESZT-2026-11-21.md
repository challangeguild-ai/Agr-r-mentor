# Agrár Mentor 2.1 – hétvégi teljes rendszerpróba

**Tervezett időpont:** 2026. november 21–22. (szombat–vasárnap)  
**Állapot:** előkészítve, **kézi teszt még nem történt**.  
**Tesztelendő:** a #59 Draft PR Vercel Preview-ja, nem az éles `main` ág.  
**Cél:** a teljes rendszer bejárása, megismételhető hibák összegyűjtése és fontossági sorrendbe rendezése; nem élesítés.

## Mielőtt elkezdjük

- [ ] Ellenőrizni a tesztoldal pontos URL-jét és a Preview `Ready` állapotát.
- [ ] Előre kijelölni egy **tesztgazdaságot** és **tesztadatokat**. Éles gazdálkodói műveletet, növényvédelmi naplót vagy feladatlezárást ne módosítsunk kísérletből.
- [ ] A szerepkörökhöz jogosult próbafiókokat előkészíteni: gazdálkodó, szaktanácsadó, agronómus/gazdaságvezető, munkatárs és rendszeradminisztrátor (amelyik rendelkezésre áll).
- [ ] Legalább egy telefon (Android) és egy asztali böngésző; képernyőképek készíthetők. Telefonon a helyhozzáférés beállításának állapota legyen ismert.
- [ ] Egy valódi, **személyes adatok nélküli** térképmásolat JPG/PNG/PDF és – ha elérhető – saját GeoJSON / SHP ZIP tesztfájl, több különálló és szabálytalan poligonnal.

## 1. Alapműködés és jogosultság (P0)

- [ ] Bejelentkezés és kijelentkezés; hibás jelszó; jelszó-visszaállítás.
- [ ] MFA, ahol kötelező; lejárt munkamenet; jogosulatlan visszalépés.
- [ ] Meghívó létrehozása; e-mail link és megfelelő `/invite` oldal; meghívó elfogadása.
- [ ] Gazdálkodó csak saját/hozzárendelt gazdaság adatait látja.
- [ ] Szaktanácsadó csak jogosult gazdaságot/személyt és szerkeszthető adatot kezel.
- [ ] Rendszeradminisztrátori felület nem hozzáférhető más szerepkörrel.
- [ ] Mobil és asztali navigáció: oldalváltás, visszalépés, menü, látható hibajelzések.

## 2. Gazdaságok és földtáblák (P0)

- [ ] Gazdaság kiválasztása, áttekintés és megfelelő adatok megjelenése.
- [ ] Új tábla létrehozása minimális kötelező adatból; opcionális HRSZ, kultúra, terület.
- [ ] Térképi helypont külön mentése, téves országos kezdőpont nélkül.
- [ ] Kézi szabálytalan poligon: rajzolás, csúcspont szerkesztése, törlése és újranyitás.
- [ ] OSM-határjavaslat megtalálása és ellenőrzése; hibás vagy hiányzó javaslat esetén visszalépés.
- [ ] GeoJSON és SHP ZIP import; több poligon közül a helyes kiválasztása; szerkesztett határ visszamentése.
- [ ] **Tömeges táblaimport:** szaktanácsadó → Táblaimport; tesztgazdaság és több poligont tartalmazó GeoJSON/SHP ZIP; fájl-előnézet, tábla neve, pipálás, mentés, majd ellenőrzés az összesített térképen.
- [ ] **Import előnézet műholdképen:** a kiválasztott alak valóban a megfelelő helyen látható-e; belső kivágások és különálló részek; utcatérképre váltás; felcserélt koordináták figyelmeztetése; műholdas térképszolgáltató hibája esetén alakvázlat.
- [ ] **Tömeges import védelmei:** már meglévő táblanév, fájlon belüli névütközés, duplikált geometria, érvénytelen vetület, több mint 50 kijelölés és megszakadt kapcsolat. Gazdálkodói szerepkörrel nem írható.
- [ ] **Ismételt feltöltés és félbeszakadt mentés:** azonos név és határ esetén 0 új rekord, eltérő határ / azonos név esetén tiltás; vegyes fájlból csak a ténylegesen hiányzó táblák jönnek létre.
- [ ] Térképfotó/PDF: zárt határ kiválasztása, három illesztési pont a dokumentumon és a térképen, poligon előnézet.
- [ ] Ferde fotó négy illesztési ponttal; gyenge fotó, nyitott határ és több PDF-oldal kezelése.
- [ ] **Valóságellenőrzés:** poligon élei és sarkai a műholdképhez képest; a művelt tábla és a jogi földrészlet esetleges különbsége.
- [ ] Megjelenített poligon a tábla adatlapján, GPS-ellenőrzéshez megfelelő geometria.
- [ ] **Gazda által beküldött táblahatár-javaslat:** tábla adatlapján megjelenő szerkesztő, csak helyponttal, kézi alakzattal, OSM-javaslattal, GeoJSON/SHP ZIP importtal és térképfotó/PDF-képpel külön-külön kipróbálva; semmi sem kötelező a helyponton kívül.
- [ ] **Javaslat nem változtatja meg azonnal a földtáblát:** gazda beküldése után csak „Szaktanácsadói ellenőrzésre vár” státusz és értesítés jelenik meg. Újabb függő javaslat ugyanahhoz a táblához ne hozható létre.
- [ ] **Szaktanácsadói jóváhagyás:** Határjavaslatok menü → javaslat → jelenlegi és javasolt teljes, akár több részből álló poligon ellenőrzése → jóváhagyás. Az elfogadott határnak és a forrásnak egyeznie kell a beküldöttel.
- [ ] **Elutasítás:** a javaslat visszautasítható megjegyzéssel, a régi poligon változatlan marad, a gazda új javaslatot küldhet.
- [ ] **Konfliktus és jogosultság:** a beküldés óta módosított táblahatárra a jóváhagyás nem írhat rá; munkatárs és idegen gazdaság tagja ne küldhessen be javaslatot; gazda ne hagyhasson jóvá; az adatbázis közvetlen írása legyen tiltva.
- [ ] **Pont alapú javaslat meglévő poligonon:** az elbíráló egyértelmű figyelmeztetést kap, hogy elfogadás esetén az előző poligon törlődik.

## 3. Gazdálkodói műveletek, tervek, növényvédelem (P0)

- [ ] Műveleti űrlap négy lépésben; mezőválasztás/kultúra/művelettípus konzisztenciája.
- [ ] Félbehagyott művelet piszkozatának megőrzése ugyanabban a böngészőmunkamenetben.
- [ ] Dátum, terület, mennyiség, tizedesbevitel, gép és végrehajtó érvényesítése.
- [ ] Növényvédelmi készítmény keresése és hivatalos felhasználási adatok betöltése.
- [ ] Nem engedélyezett/lejárt készítmény, rossz dózis, hibás kultúra vagy hiányzó jóváhagyó elutasítása.
- [ ] Szaktanácsadói terv és jóváhagyási folyamat külön jogosultságokkal.
- [ ] Egyszeri mentés utáni idővonal/művelet megjelenése; véletlen dupla kattintás kezelése.
- [ ] Hiba utáni részleges siker: ne keletkezzen duplikált művelet vagy terv.

## 4. Munkakiosztás, végrehajtás, gépek (P0)

- [ ] Új feladat helyes gazdaság–földtábla–munkatárs–gép összerendeléssel.
- [ ] Szaktanácsadói egyszerű teendő: másik gazdaságra váltás törli a korábbi táblát/végrehajtót; a tulajdonos az alapértelmezett; teljes gazdaságra tábla nélkül is létrehozható.
- [ ] Egyszerű teendő mentése: téves naptári nap elutasítása, egyszeri sikervisszajelzés, értesítési/e-mail-hiba esetén a már létrejött feladatot nem küldjük be újra.
- [ ] Végrehajtás visszaigazolása vagy javításra küldése után egy hibás értesítés nem jelenti a szakmai döntés sikertelenségét; a státusz és a műveleti napló legyen az elsődleges igazságforrás.
- [ ] Helyes státuszok: kiosztva, folyamatban, ellenőrzésre vár, javításra visszaküldve, kész.
- [ ] Napi munka, teendők, ellenőrzési és jóváhagyási körök.
- [ ] Munkatárs telefonon GPS-t kér; jogosultság megtagadva, rossz pontosság, határon kívüli hely kezelése.
- [ ] **Friss GPS:** 15 percnél régebben rögzített pozícióval ne engedjen beküldeni, kérjen új mérést; friss pozícióval engedjen tovább (a fotót és az űrlapadatokat ne veszítse el).
- [ ] **GPS-mérési idő:** a beküldött igazolásban az eredeti telefonos mérés időpontja szerepeljen, ne a fotófeltöltés vagy a szerveres mentés időpontja. Hosszabb/félbeszakadt feltöltés után a szerver is utasítsa el az elavult pozíciót.
- [ ] **Közvetlen RPC megkerülési kísérletek (tesztfiókkal):** hamis `TASKPROOF` szöveg, hiányzó fotó, idegen felhasználói tárhelyút, 15 percnél régebbi GPS, táblán kívüli koordináta, kizárt belső poligonlyuk és nem aktív növényvédő szer minden esetben álljon meg az adatbázisban. Éles gazda adatait ne használjuk.
- [ ] Fénykép csatolása, végrehajtási adatok, lezárás, egyértelmű sikervisszajelzés.
- [ ] **Földtábla adatlapjáról indított munka:** „Igazolás beküldése” a megfelelő teendőhöz visz; nem lehet közvetlenül „Kész” állapotba tenni a szaktanácsadói jóváhagyás előtt.
- [ ] **Egyszerű, leírás nélküli táblafeladat:** a GPS- és fényképes űrlap akkor is elérhető, ha a feladatnak nincs részletes leírása vagy műveleti terve.
- [ ] **Ellenőrzésre váró / lezárt / törölt teendő:** a térképi adatlap és a teendőlista sem kínál új végrehajtás-beküldést; az ellenőrzésre váró állapot egyértelmű.
- [ ] **Csak gazdasághoz, tábla nélkül kiosztott általános teendő:** a végrehajtó rövid beszámolóval küldi ellenőrzésre, GPS és fotó nélkül; a jóváhagyás véglegesen lezárja, a visszaküldés új beküldést enged.
- [ ] **Gazdaságszintű beküldés védelmei:** üres / túl rövid megjegyzés tiltása, idegen gazdaság és más munkatárs feladatának elutasítása, dupla kattintás és hálózati megszakítás esetén legfeljebb egy ellenőrzésre váró teljesítés.
- [ ] Ismételt vagy részben sikeres beküldés nem tüntet el bizonyító fotót és nem hoz létre dupla lezárást.
- [ ] **Megszakadt válasz az első beküldés után:** ha a szerver már eltárolta a GPS-es igazolást, de a telefon hibát lát, az ismétlés nem törölheti az eredetileg hivatkozott fotót. Az igazolás és a feladat állapota egyezzen meg.
- [ ] **Ismételt fotófeltöltés:** bizonytalan hálózati eredmény után ugyanabban az űrlapban a korábban feltöltött fájlt használja újra; csak megerősített, nem felhasznált másolatot távolítson el. Sikertelen Storage-törlés ne maradjon néma.
- [ ] Gépnyilvántartás és tényleges géphasználat a kapcsolt feladaton.

## 5. További felületek (P1)

- [ ] Dashboard és munkaközpont: státusz, hiányzó adatok, folytatási javaslatok és valódi számok.
- [ ] Időjárás: utolsó frissítés, hét- és harmincnapos csapadék, hiányzó mérés megkülönböztetése a nullától.
- [ ] Térképes áttekintés, GPS-problémagócok, események és idővonal.
- [ ] Üzenetek, értesítések, kapcsolatok, csapat és meghívók.
- [ ] **Gazdálkodói bejelentés:** új bejelentés után a szaktanácsadó ténylegesen kapjon értesítést, az értesítés a megfelelő bejelentési nézetre vezessen.
- [ ] **Problémagóc létrehozása és lezárása:** a gazda eseménye után csak az arra jogosult szaktanácsadó kapjon értesítést; a hivatkozás az adminisztrátori térképre vezessen.
- [ ] **Értesítési jogosultság:** idegen bejelentés/teendő azonosítójával, vagy kitalált eseményazonosítóval ne lehessen értesítést küldeni a szaktanácsadóknak.
- [ ] Dokumentumok, számlák, jelentések, látogatások, ellenőrzések.
- [ ] Rendszeradmin: felhasználók, biztonság, időjárás és mentés (csak jogosult fiókkal, kockázatos írás nélkül).
- [ ] Bevezető túra, súgó, olvashatóság és képernyőolvasó/billentyűzet alapműködése.

## 6. Mobil és hibakezelés (P1)

- [ ] Android 360–390 px szélességen nincs levágott gomb, vízszintes kilógás vagy lefedett mentés.
- [ ] Forgatás, billentyűzet megnyitása, hosszú lista és modális ablakok kezelése.
- [ ] Gyengébb internet mellett érthető hiba, újrapróbálás és nincs észrevétlen adatvesztés.
- [ ] Hibás fájl, túlméretes fájl, kapcsolatvesztés, tiltott mező szerkesztése.
- [ ] Telefonon fényképfeltöltés és helymeghatározás kezelhetősége.

## Hibajegy – minden hibát külön ilyen formában rögzítsünk

```text
Azonosító: AM-001
Prioritás: P0 / P1 / P2
Terület/oldal:
Szerepkör és készülék/böngésző:
Előfeltétel:
Lépések a hiba előidézéséhez: 1. 2. 3.
Elvárt eredmény:
Tényleges eredmény:
Ismételhető? Mindig / Néha / Egyszer
Képernyőkép vagy videó:
Állapot: Új / Javítás alatt / Újratesztelésre vár / Lezárt
```

**Prioritás:**
- **P0:** jogosultsági/adatszivárgási hiba, adatvesztés, duplikált mentés, téves GPS/határ miatti fontos üzleti következmény, blokkolt alapfolyamat.
- **P1:** működő funkciót jelentősen nehezítő hiba, hibás visszajelzés, mobilon elérhetetlen vezérlő.
- **P2:** kozmetikai eltérés, kisebb kényelmetlenség vagy későbbi bővítési ötlet.

## Lezárási szabály

- [ ] P0 hiba nincs nyitva.
- [ ] P1 hibákhoz felelős/javítási terv és ismételt ellenőrzési időpont van.
- [ ] Nincs nem tisztázott Supabase RLS/MFA, meghívó origin vagy éles környezeti konfiguráció.
- [ ] A teljes rendszerpróbát követően külön döntünk a #59 → #58 merge-ről. Production élesítéshez további explicit jóváhagyás kell.

**Ez a lista előkészület a hétvégi közös teszthez, nem tesztjegyzőkönyv és nem sikerigazolás.**

**Adatbázis-feltétel:** a gazdaságszintű teendők új beküldéséhez a `20261119080000_general_task_attestation_review.sql` migráció telepítése szükséges. A migráció jelenleg kizárólag a Draft PR része; a kapcsolt Supabase adatbázisra még nincs alkalmazva. A hétvégi próbán ezt előfeltételként külön ellenőrizni kell.

**Értesítési jogosultság:** a bejelentések és problémagócok értesítési javítása a `20261119093000_authorized_advisor_notifications.sql` migrációban vár telepítésre. Alkalmazása nélkül az új értesítési eseteket nem lehet késznek tekinteni.

**GPS-es RPC biztonsági előfeltétel:** a `20261119110000_verified_task_proof_rpc_guard.sql` migráció a közvetlen adatbázis-hívásnál ellenőrzi a GPS-t, a ténylegesen feltöltött fényképet, a táblahatárt és az aktuális növényvédelmi kapcsolatok alapvető érvényességét. Ez a migráció is **csak előkészítve**, az éles Supabase adatbázison nincs alkalmazva. A konkrét SQL-működés kézi/integrációs kipróbálása a hétvégi teszt része.

**Gazdálkodói táblahatár-javaslatok előfeltétele:** a `20261119123000_field_boundary_proposals.sql` migráció létrehozza a függő javaslatokat, a koordinátor jogosultsági ellenőrzését és az atomikus szaktanácsadói jóváhagyást. Ez is **csak a Draft PR része**, nem került az éles adatbázisba. Telepítés nélkül a gazda adatlapján a beküldés nem érhető el; a hétvégi teszt előtt az alkalmazást és a DB-migrációkat össze kell hangolni a tesztkörnyezettel.
