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
- [ ] **Táblahatár-minőségjelzések:** eltérő nyilvántartott hektár, kilométerekkel elcsúszott poligon és csak helypontra cserélt régi határ jelzése a gazda beküldése előtt; a figyelmeztetés nem tilthatja le az opcionális javaslatot.
- [ ] **Valódi területi átfedés:** szaktanácsadói javaslat ellenőrzésénél átfedő szomszédos tábla felvetése; közös mezsgye, csak érintkező sarok és poligon belső kivágása ne okozzon hamis riasztást. Több részpoligonból álló terület ellenőrzése.
- [ ] **Részleges ellenőrzés:** ha túl nagy vagy hibás szomszédgeometria, illetve 50 táblás lekérdezési korlát miatt nem teljes az összehasonlítás, ne jelenjen meg bizonyosságot sugalló „minden rendben” felirat.
- [ ] **Szaktanácsadói Határellenőrzés oldal:** hiányzó térképi hely, csak helypont, eltérő hektár és hibás régi alakzat listázása; 50 táblás lapozás; a kijelölt földtábla térképszerkesztőjére navigálás. Gazdálkodói fiókkal ne legyen elérhető.

## 3. Gazdálkodói műveletek, tervek, növényvédelem (P0)

- [ ] Műveleti űrlap négy lépésben; mezőválasztás/kultúra/művelettípus konzisztenciája.
- [ ] Félbehagyott művelet piszkozatának megőrzése ugyanabban a böngészőmunkamenetben.
- [ ] Dátum, terület, mennyiség, tizedesbevitel, gép és végrehajtó érvényesítése.
- [ ] Növényvédelmi készítmény keresése és hivatalos felhasználási adatok betöltése.
- [ ] Nem engedélyezett/lejárt készítmény, rossz dózis, hibás kultúra vagy hiányzó jóváhagyó elutasítása.
- [ ] Szaktanácsadói terv és jóváhagyási folyamat külön jogosultságokkal.
- [ ] Egyszeri mentés utáni idővonal/művelet megjelenése; véletlen dupla kattintás kezelése.
- [ ] Hiba utáni részleges siker: ne keletkezzen duplikált művelet vagy terv.
- [ ] **Gazdálkodói műveleti napló megszakadt mentése:** az első sikeres adatbázis-írás után elveszett válasz esetén ugyanabból az űrlapból újraküldve csak egy művelet marad; az idővonal sem duplázódik. Böngészőfrissítés után a változatlan kitöltés megőrzi a mentési próbálkozás azonosítóját, az eltérő kitöltés új próbálkozásnak számít. A naplót ellenőrizni kell, ha az idővonal-frissítés eredménye bizonytalan.
- [ ] **Műveleti terv kétlépcsős mentésének újrapróbálása:** ha a feladat már létrejött, de a részletes terv mentése megszakad, a feladat nem törlődik; ugyanebből az űrlapból újraküldve csak a hiányzó terv mentődik. Ha az első mentés valójában sikeres volt, második terv és értesítés nem keletkezik. A gép hozzárendelése külön pótolható; eltérő tervvel újrafelhasznált mentési azonosító hibát ad.

## 4. Munkakiosztás, végrehajtás, gépek (P0)

- [ ] Új feladat helyes gazdaság–földtábla–munkatárs–gép összerendeléssel.
- [ ] Szaktanácsadói egyszerű teendő: másik gazdaságra váltás törli a korábbi táblát/végrehajtót; a tulajdonos az alapértelmezett; teljes gazdaságra tábla nélkül is létrehozható.
- [ ] Egyszerű teendő mentése: téves naptári nap elutasítása, egyszeri sikervisszajelzés, értesítési/e-mail-hiba esetén a már létrejött feladatot nem küldjük be újra.
- [ ] **Munkakiosztás és műveleti terv utólagos képernyőfrissítési hibája:** a már rögzített feladatnál a frissítés hibája csak figyelmeztetés; a feladat és a terv nem kerül újraküldésre.
- [ ] Végrehajtás visszaigazolása vagy javításra küldése után egy hibás értesítés nem jelenti a szakmai döntés sikertelenségét; a státusz és a műveleti napló legyen az elsődleges igazságforrás.
- [ ] Helyes státuszok: kiosztva, folyamatban, ellenőrzésre vár, javításra visszaküldve, kész.
- [ ] Napi munka, teendők, ellenőrzési és jóváhagyási körök.
- [ ] Munkatárs telefonon GPS-t kér; jogosultság megtagadva, rossz pontosság, határon kívüli hely kezelése.
- [ ] **Friss GPS:** 15 percnél régebben rögzített pozícióval ne engedjen beküldeni, kérjen új mérést; friss pozícióval engedjen tovább (a fotót és az űrlapadatokat ne veszítse el).
- [ ] **GPS-mérési idő:** a beküldött igazolásban az eredeti telefonos mérés időpontja szerepeljen, ne a fotófeltöltés vagy a szerveres mentés időpontja. Hosszabb/félbeszakadt feltöltés után a szerver is utasítsa el az elavult pozíciót.
- [ ] **Közvetlen RPC megkerülési kísérletek (tesztfiókkal):** hamis `TASKPROOF` szöveg, hiányzó fotó, idegen felhasználói tárhelyút, 15 percnél régebbi GPS, táblán kívüli koordináta, kizárt belső poligonlyuk és nem aktív növényvédő szer minden esetben álljon meg az adatbázisban. Éles gazda adatait ne használjuk.
- [ ] **Megszűnt gazdasági tagság és demó-GPS:** a feladathoz rendelt, de a gazdaságból időközben eltávolított végrehajtó se a webfelületen, se közvetlen RPC-n ne tudjon beküldeni. A „DEMÓGAZDASÁG” elnevezés soha ne mentesítsen a tényleges helyellenőrzés alól; a próbaföldtáblát a valós teszthelyszín közelében kell felvenni.
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
- [ ] **Csapadéknapló (valódi méréssel):** 7/30 nap mm-összeg, esős napok száma és ténylegesen mért napok száma helyes; 0 mm-es mérés külön megjelenik, a hiányzó nap nem számít száraz napnak.
- [ ] **Napi tételek:** az elmúlt 30 nap mérési napjai csökkenő sorrendben, egy nap csak egyszer, megfelelő állomással és mérési forrással; 06–06 UTC mérési időszak értelmezhető.
- [ ] **Adatkapcsolat:** rendszeradminisztrátori időjárási oldalon látszik az utolsó sikeres/részleges/hibás futás, az adatfrissítés és a problémás vagy elmaradt szinkron. Kézi szinkront csak előre jóváhagyott tesztadatokon futtassunk.
- [ ] **Ismétlés és helyesbítés:** ugyanazt a mért napot újraszinkronizálva nem nő az idővonalesemények száma; módosított napi mm-értéknél a meglévő esemény szövege helyesbül, 0 mm-re javításkor sem marad régi esőmennyiség a naplóban.
- [ ] **Részleges siker és sok tábla:** hiányzó koordináta, távoli állomás vagy hibás adatlekérés esetén nem szerepelhet teljes siker; a rendszeradminisztrátor indoklást lát. Több mint 1000 földtáblánál sem maradhatnak ki észrevétlenül rekordok a lapozás miatt.
- [ ] **Forrásadat hibája:** sérült vagy hiányzó HungaroMet CSV/ZIP, félbeszakadt letöltés és téves állomásazonosító esetén egyértelmű sikertelen/részleges futás jelenjen meg; a hibás adat ne kerüljön be mért csapadékként.
- [ ] **Mérőállomás kiesése:** ha a legközelebbi állomás nem ad friss mérést, legfeljebb két további, 35 km-en belüli állomást próbálunk; az adminnapló mutassa a tartalék használatát és a sikertelen lekérést. 35 km-en túli mérés soha ne kerüljön a táblához.
- [ ] **Elavult mérési sor:** ha a legújabb használható napi adat 3 napnál régebbi, a szinkron részleges legyen, és jelenjen meg az ok; a tárolt, de régi mérés ne legyen frissként feltüntetve. Állomáscsere esetén egy napi esőesemény maradjon az idővonalon.
- [ ] Térképes áttekintés, GPS-problémagócok, események és idővonal.
- [ ] Üzenetek, értesítések, kapcsolatok, csapat és meghívók.
- [ ] **Kapcsolattartók biztonságos mentése:** meglévő gazdasági és saját elérhetőségek módosítása, új telefonszám/e-mail hozzáadása és szándékos törlése; a megőrzendő elérhetőségek hálózati/mentési hiba után se tűnjenek el. Azonos űrlap ismételt mentése ne duplikáljon sorokat.
- [ ] **Új gazdaság elérhetőségekkel:** érvényes telefon és e-mail nélkül semmi se jöjjön létre; ismételt azonos gazdaság felvétele ne hozzon létre második rekordot. Kapcsolattartói írási hibánál a már létrejött gazdaság maradjon meg, a felület közölje a részleges sikert, adjon közvetlen hivatkozást a gazdaságra és az elérhetőségek pótlására. Újrapróbálás ne hozzon létre duplikátumot.
- [ ] **Gazdálkodói bejelentés:** új bejelentés után a szaktanácsadó ténylegesen kapjon értesítést, az értesítés a megfelelő bejelentési nézetre vezessen.
- [ ] **Szaktanácsadói válasz és teendő:** érvénytelen határidő vagy túl hosszú teendőnév még válaszmentés előtt utasítódjon el. Sikeres válasz után hibás teendő-/idővonal-/értesítési írásnál részleges siker és feladatlista-ellenőrzés látszódjon; a válasz ismételt beküldése ne küldjön új értesítést vagy duplikált teendőt. Lezárás után az ismételt kattintás ne zárja le újra a bejelentést.
- [ ] **Feladat létrehozása megszakadt kapcsolat után:** egyszerű szaktanácsadói teendőnél és gépes munkakiosztásnál a mentés visszaigazolásának elvesztése után ugyanazt a próbálkozást újraküldve csak egy teendő maradjon. Ne keletkezzen második értesítés, munkanapló-bejegyzés vagy gépkiosztás; a már létrejött teendő és a kapcsolt gép ellenőrzését jelezze a rendszer. Szándékosan indított új feladat viszont saját új mentési azonosítóval legyen létrehozható.
- [ ] **Táblaszemle részleges mentése:** sikeresen mentett szemle után hibás idővonal-/értesítési írás vagy nem igazolható automatikus teendő nem adhat teljes mentési hibát, nem hozhat létre második szemlét. A teendőt külön ellenőrizzük a munkalistán.
- [ ] **Szemle több csatolmánnyal:** érvénytelen dátum vagy túlméretes/tiltott fájl még szemle létrehozása előtt álljon meg. Második kép megszakadt feltöltése után az újrapróbálás ugyanahhoz a szemléhez folytassa; az első képet ne töltse fel újra.
- [ ] **Szemléből jelölt GPS-problémapont:** a mentett pont a tényleges problémagócok listájában és térképén is olvasható legyen; kritikus súlyosság és pontos koordináták megmaradjanak.
- [ ] **Bejelentés képpel/videóval:** a 3. lépésben kiválasztott fájlok a 4. lépésen át megmaradnak, a csatolmányok darabszáma látszik az összesítésben, és a mentett bejelentés mellett mind megjelennek. A túl nagy vagy nem támogatott fájlt a bejelentés létrehozása előtt utasítsa el.
- [ ] **Bejelentés megszakadt feltöltéssel:** ha a bejelentés már mentve van, de a második csatolmány feltöltése vagy adatbázis-kapcsolása megszakad, a „Hiányzó csatolmányok újrapróbálása” csak a hiányzó fájlokkal folytassa, új bejelentést ne hozzon létre, és a korábbi fájl se töltődjön fel kétszer.
- [ ] **Problémagóc létrehozása és lezárása:** a gazda eseménye után csak az arra jogosult szaktanácsadó kapjon értesítést; a hivatkozás az adminisztrátori térképre vezessen.
- [ ] **Problémagóc részleges mentése:** szaktanácsadói automatikus teendő létrehozásának hibájánál a térképi jelölés megmarad; a felület jelzi, ha a teendő mentése bizonytalan, és a teendőlista ellenőrzését kéri, nem a jelölés újbóli létrehozását. Ismételt kattintás, üres GPS-pont és érvénytelen teendő-határidő ellenőrzése.
- [ ] **Problémagóc lezárásának ismétlése:** a lezárt jelölést nem zárja le újra, nem ismétli a küldést, és az eredeti rögzítő személye megmarad; értesítési hiba nem jelzi tévesen sikertelennek a már elvégzett lezárást.
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

**Csapadék előfeltétel (2026-11-19):** a kapcsolt Supabase adatbázisban 7 tábla található, de a `field_weather_daily` és a `weather_sync_runs` egyaránt üres. A HungaroMet-szinkron működése ezért még nincs éles vagy Preview-adattal igazolva. A Vercel Cron csak Production telepítésen időzített; a Preview ellenőrzéshez egy külön, jogosult és előre egyeztetett kézi futás szükséges. Nem szabad a hiányzó adatot 0 mm-es csapadékként értelmezni.

**Cron felügyeleti javítás (2026-11-19):** ha van nyilvántartott földtábla, de a szinkron egyetlen táblához sem tud mérést menteni, a Cron API most HTTP 503-at és `ok: false` értéket ad, miközben a szinkron futásnaplója megtartja a tényleges `partial` státuszt és az okokat. Legalább egy sikeres tábla esetén a részleges eredmény továbbra is HTTP 200, az eltérés a válaszban és az admin futásnaplóban látható. A Vercel a sikertelen Cron-hívásokat nem ismétli automatikusan; az üzemeltetőnek a naplót kell ellenőriznie. Ez a javítás **nem indított el éles szinkront**. Az AgrárMentor Vercel-projektje a jelenleg kapcsolt Vercel-fiókokban nem volt elérhető, ezért a Production Cron, a `CRON_SECRET` és az adatbáziskapcsolat beállítása még külön ellenőrzendő.

**GPS-es RPC biztonsági előfeltétel:** a `20261119110000_verified_task_proof_rpc_guard.sql` migráció a közvetlen adatbázis-hívásnál ellenőrzi a GPS-t, a ténylegesen feltöltött fényképet, a táblahatárt és az aktuális növényvédelmi kapcsolatok alapvető érvényességét. Ez a migráció is **csak előkészítve**, az éles Supabase adatbázison nincs alkalmazva. A konkrét SQL-működés kézi/integrációs kipróbálása a hétvégi teszt része.

**Kiemelt jogosultsági figyelmeztetés (2026-11-19):** a kapcsolt Supabase adatbázis jelenleg telepített `submit_verified_task_execution` függvénye a csak olvasható ellenőrzés szerint még nem tartalmaz külön aktív gazdasági tagság- és tényleges Storage-fotóellenőrzést. A Draft PR-ban előkészített szigorított migráció most már mindkettőt megköveteli, valamint a demónév alapján adott GPS-felmentést is megszünteti. **A módosított migráció telepítése és jogosultsági ellenőrzése nélkül ezt a P0 biztonsági pontot nem szabad lezártnak tekinteni.** Jelen körben nem történt éles adatbázis-módosítás.

## 2026-11-19 – kiadás előtti valós környezeti ellenőrzés

- **Forrás és telepítés nem ugyanaz:** a legújabb javítások a meglévő [#59 Draft PR](https://github.com/challangeguild-ai/Agr-r-mentor/pull/59) ágában vannak; a PR a #58 fejlesztési ágra épül, nem közvetlenül az élő `main`-re. A sikeres Vercel Preview-build önmagában nem telepít Supabase SQL-migrációt vagy Edge Functiont.
- **Vercel-hozzáférés:** az `info.waterk@gmail.com` fiókkal kapcsolt integráció csak a `water-k-native` projektet mutatja a látható `infowaterk-5067` csapatban; az `agr-r-mentor` projekt lekérdezése 404. A másik kapcsolt Vercel-fiókban sem jelent meg AgrárMentor-projekt. A pontos célcsapat Vercel URL-jét/slugját és a csapathoz való hozzáférés jóváhagyását be kell szerezni. A böngészőben jelenleg Vercel-belépési oldal jelent meg, ezért a környezeti változókat és a Cron-beállításokat nem ellenőriztük.
- **Négy függő migráció:** `20261119080000_general_task_attestation_review.sql`, `20261119093000_authorized_advisor_notifications.sql`, `20261119110000_verified_task_proof_rpc_guard.sql`, `20261119123000_field_boundary_proposals.sql`. Egyik sincs alkalmazva a kapcsolt adatbázisban. Csak olvasási ellenőrzéssel igazoltuk a szükséges meglévő oszlopokat, a `task_execution_reports(task_id)` és `notifications(user_id,event_key)` egyedi indexeit, valamint a `gis` sémában telepített PostGIS-t. Ez nem helyettesíti az alkalmazás előtti mentést, tranzakciós migrációs próbát és szerepkörös teszteket.
- **Éles Edge Functionök eltérnek a javítóágtól:** a kapcsolt Supabase `invite-farmer` (v8), `invite-advisor` (v5) és `send-notification-email` (v4) funkcióiban a csak olvasható forrásvizsgálat még a **régi** `agr-r-mentor.vercel.app` címet találta; az új `APP_PUBLIC_ORIGIN`-ellenőrzés nincs bennük. A javítóágon a levelezési funkció is megszünteti a régi címre való visszaesést: hiányzó beállításnál biztonságosan leáll. Az új funkcióverziókat, a Supabase Edge titkok `APP_PUBLIC_ORIGIN` értékét, a Vercel szerverbeállítást és a Supabase Auth Redirect URLs listát ugyanarra az ellenőrzött aktuális originre kell összehangolni.
- **Valódi időjárási adat még nincs igazolva:** 7 földtábla mellett 0 `weather_sync_runs` és 0 `field_weather_daily` sor. Az automatikus Production Cron és egy jogosult, felügyelt próbaszinkron külön kapu marad.

**Bevezetési sorrend, csak külön jóváhagyással:** (1) Vercel célprojekt/Preview és aktuális domain azonosítása; (2) szükséges biztonsági mentés és a négy Supabase-migráció ellenőrzött alkalmazása; (3) a három Edge Function és az origin/redirect környezet összehangolása; (4) valódi farmer–munkatárs–szaktanácsadó–admin E2E, meghívó és értesítő e-mail, GPS/fotó, térkép, időjárás; (5) hibák újratesztelése; (6) külön döntés az összevonásról és az élesítésről. **Ez a feljegyzés nem igazolja a telepítés megtörténtét és nem engedélyezi az éles adatírást.**

**Stabilitási kódellenőrzés:** a GPS-es beküldés szerveroldali tagságellenőrzése és a két táblahatár-javaslati `SECURITY DEFINER` függvény szűkített `search_path` beállítása is elkészült. **154/154 automatizált teszt és teljes helyi production build sikeres**; az SQL-migrációk éles végrehajtása nem történt meg.

**Térképi problémagóc stabilitása (2026-11-19):** a pont és az opcionális teendő külön mentése esetén a már rögzített pontot nem mutatjuk sikertelennek, ha a teendő vagy az értesítés hibás. Bizonytalan teendőállapotnál először a teendőlista ellenőrzését kérjük. Üres koordináta és hibás határidő az első írás előtt elutasítva; a kliens meggátolja a gyors dupla beküldést, a lezárt pont megőrzi az eredeti rögzítőjét. **156/156 automatizált teszt és teljes helyi Next.js build sikeres.** Mindez kódszintű ellenőrzés; kézi rendszerpróba továbbra sem történt, Supabase-migráció nem futott.

**Gazdálkodói bejelentés csatolmányai (2026-11-19):** a fájlmező a varázsló 3→4. lépésváltásakor a DOM-ban marad, így a képek/videók a tényleges elküldéshez is eljutnak. A 4. lépés megmutatja a kijelölt fájlok számát, a méret- és fájltípus-ellenőrzés a bejelentés mentése előtt történik. Már létrejött bejelentéshez a félbemaradt csatolmányfeltöltés azonos bejelentésazonosítóval folytatható; a megerősített feltöltések és médiakapcsolatok nem ismétlődnek. Az értesítés hibája nem változtatja meg a sikeres bejelentésmentés állapotát. **157/157 automatizált teszt és teljes Next.js build sikeres**; kézi böngészős/feltöltési próbát a hétvégére halasztottuk. Nincs új migráció vagy éles adatírás.

**Értesítési visszajelzés pontosítása (2026-11-19):** a bejelentéseknél és problémagócoknál a jogosult szaktanácsadók listájának üres eredménye nem számít bizonyított értesítési sikernek; a felhasználó a már mentett eseményről és a bizonytalan értesítésről külön figyelmeztetést kap. Ez különösen fontos, amíg a szigorított értesítési RPC migrációja nincs alkalmazva. **158 automatizált teszt** sikeres; kézi értesítésteszt még nem volt.

**Táblaszemle és kapcsolattartók stabilitási köre (2026-11-19):** a mentett szemle nem válik látszólag sikertelenné egy később elromló teendő, idővonal vagy értesítés miatt; részleges státuszt és teendőlista-ellenőrzést kér. Félbemaradt szemlefájlok ugyanahhoz a szemléhez folytathatók, az igazolt csatolmányok nem töltődnek fel újra. A szemléből származó GPS-problémapontokat a térképi problémagócok által olvasható formában írjuk. A munkakiosztás és műveleti terv utólagos cache-frissítési hibája nem jelent teljes mentési hibát. A gazdasági és személyes elérhetőségek mentése nem törli előre az összes régi rekordot: meglévő sorokat egyeztet, új sorokat előbb ment, a szándékosan elhagyottakat csak sikeres előző lépések után törli. Ez **nem teljes adatbázis-tranzakció**, de megszünteti a törlés utáni beírási hiba miatti teljes adatvesztést. **168 automatikus teszt és teljes helyi build sikeres**; az új folyamatok kézi próbája továbbra is a hétvégi teszt része, és nem történt éles DB-írás.

**Új gazdaság felvételének védelme (2026-11-19):** a gazdaság létrehozásakor már az első írás előtt azonos, normalizált telefon/e-mail ellenőrzést végzünk, mint a kapcsolattartók szerkesztésekor. A kapcsolattartók hibája nem indít gazdaságtörlést és nem rejtőzik általános mentési hiba mögé; a felület megmutatja a részleges sikert és az ellenőrzési hivatkozásokat. Azonos gazda, név, település és cím újraküldése előtt meglévő gazdaságot keresünk; bizonytalan beszúrási visszajelzés esetén még egyszer ellenőrzünk. Ez **alkalmazásszintű duplikációcsökkentés**, nem teljes tranzakciós vagy konkurens beszúrás elleni adatbázisgarancia. **175/175 automatikus teszt és teljes helyi Next.js production build sikeres.** A hétvégi teszt előtt nem történt éles adatírás.

**Bejelentésválaszok és teendők védelme (2026-11-19):** a válaszhoz tartozó teendő hibás határideje vagy szövege már az első adatbázis-írás előtt elutasítódik. Mentéskor visszaigazolást kérünk a módosított bejelentésről, és ellenőrizzük a korábbi módosítás időpontját. A már elmentett, azonos válasz ismétlése nem eredményez második értesítést vagy teendőt; a teendő, idővonal, értesítés és e-mail részleges hibái külön figyelmeztetést kapnak. A képernyő sikeres és részleges sikerre külön visszajelzést ad, és a már befejezett művelet ismételt kattintását tiltja. A két adatbázistábla közötti művelet **nem atomikus tranzakció**, a bizonytalan teendőállapotot a hétvégi próbán továbbra is ellenőrizni kell. **181/181 automatikus teszt, teljes TypeScript-ellenőrzés és helyi Next.js production build sikeres.** A kapcsolt Supabase-ben a szükséges bejelentés- és teendőmezők csak olvasással igazolva. Nem történt éles bejelentéskezelés vagy adatbázis-írás.

**Teendők ismételt mentésének védelme (2026-11-19):** az egyszerű szaktanácsadói feladat és a gazdasági munkakiosztás egy-egy böngészős mentési kísérlethez UUID-t használ, amit sikertelen vagy megszakadt visszaigazoláskor megtart. A szerver feladatbeszúrás előtt ellenőrzi ezt az azonosítót, és bizonytalan beszúrási eredmény után is visszaolvassa a tényleges rekordot. A megegyező kérés nem hoz létre újabb feladatot, mellékeseményt vagy értesítést; eltérő tartalmú kérésnél azonos azonosítót nem fogad el. A megoldás **ugyanazon beküldés ismétlését védi**, nem tiltja a két szándékosan külön indított azonos nevű feladatot. A kapcsolt Supabase `tasks.id` UUID mezője és elvárt oszlopai csak olvasással ellenőrizve, éles adatírás nélkül. **188/188 automatikus teszt, TypeScript-ellenőrzés és teljes helyi Next.js production build sikeres.**

**Gazdálkodói táblahatár-javaslatok előfeltétele:** a `20261119123000_field_boundary_proposals.sql` migráció létrehozza a függő javaslatokat, a koordinátor jogosultsági ellenőrzését és az atomikus szaktanácsadói jóváhagyást. Ez is **csak a Draft PR része**, nem került az éles adatbázisba. Telepítés nélkül a gazda adatlapján a beküldés nem érhető el; a hétvégi teszt előtt az alkalmazást és a DB-migrációkat össze kell hangolni a tesztkörnyezettel.

**Csapadékmodul fejlesztési lezárás (2026-11-19):** a hivatalos adatfájl beolvasása, a naponkénti 0 mm/adathiány kezelés, 7/30 napos összesítés, az esős és mért napok száma, a többszörös állomási sorok kizárása, a földtábla-hozzárendelés, 1000 feletti táblaszám lapozása, részleges hibák naplózása, javított idővonalesemények és adminisztrátori visszajelzés kódszinten elkészült. **150 automatizált teszt és helyi build sikeres**, de az éles időzítést és az első valódi adatbeírást csak külön jóváhagyott hétvégi próbán lehet igazolni. Addig üzemeltetési szempontból **nem késznek, hanem ellenőrzésre várónak** tekintjük.

**További HungaroMet-megbízhatósági javítás (2026-11-19):** legfeljebb három közeli állomás közül a friss mérést adó kiválasztása, szükség esetén tartalék állomás használata, háromnapos frissességi figyelmeztetés, ugyanazon nap idővonaleseményének megtartása állomáscserekor, valamint olvashatóbb adminisztrátori hibajegyzék. **153/153 automatizált teszt és teljes helyi Next.js build sikeres.** Nincs új adatbázis-migráció és nincs fizetős külső szolgáltatás. A valódi adatforrás és az éles Cron **továbbra sem lett kézzel végigtesztelve**; a hétvégi forgatókönyv része.
