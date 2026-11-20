# Agrár Mentor – natív Android-alkalmazás

**Egyetlen Android-alkalmazás, egyetlen csomagazonosító:** `hu.agrarmentor.android`.

Ez külön Kotlin / Jetpack Compose projekt. **Nem WebView**, nem a honlap mobilmenüjének átírása, és nem három külön telepítendő alkalmazás. Az Agrár Mentor meglévő Supabase backendjét és a webes felülettel közös engedélyezési adatforrást használja.

## Az alkalmazás azonosítója és megjelenése

- Telepített alkalmazás neve: **Agrár Mentor** (`res/values/strings.xml`).
- Kezdőképernyős ikon: a jóváhagyott zöld-arany búzakalászos Agrár Mentor-jelkép; Android adaptív ikon és kerek ikon (`mipmap-anydpi-v26`).
- Fejléc: a meglévő, eredeti, átlátszó hátterű Agrár Mentor-logó.
- Egységes A dizájn: törtfehér háttér, lekerekített kártyák; gazdálkodó zöld, szaktanácsadó kék, admin bordó.

## Bejelentkezés és jogosultság

1. A felhasználó **e-mail-címmel és jelszóval** bejelentkezik a meglévő Supabase Auth rendszerbe.
2. Az alkalmazás szerveroldalon ellenőrizt felhasználót és a bejelentkezett személyhez tartozó **RLS által korlátozott** `public.profiles` rekordot olvas.
3. A `role` és `system_role` alapján **automatikusan** kiválasztódik a megfelelő felület:
   - `role=farmer` → gazdálkodói zöld;
   - `role=advisor` és nem admin → szaktanácsadói kék;
   - `role=advisor`, `system_role=admin` → rendszeradmin bordó.
4. Szaktanácsadó/admin esetén az eddigi webes biztonsági renddel egyezően `aal2` szükséges. Ha `aal1`, a hitelesítő alkalmazás hatjegyű TOTP-kódját kéri. Hiányzó/ellenőrizetlen faktor nem kerül megkerülésre.
5. A szerepkör nem felhasználói beállítás. **Éles alkalmazásban nincs szerepkörválasztó.** A szerver RLS szabályai továbbra is a valódi hozzáférési határt adják.

**Munkamenet:** a Supabase refresh tokent az Android Keystore nem exportálható AES-GCM kulcsa védi; az access token és a jelszó nem kerül lemezre. Újraindításkor a kliens új tokenpárra cseréli a tárolt refresh tokent, ellenőrzi a profilt és szükség esetén az AAL2-szintet. Használat közben a lejárat előtt megújítja a tokent, kijelentkezéskor törli a tárolt munkamenetet. Elfelejtett jelszó esetén a Supabase által konfigurált helyreállítási e-mail kérhető.

## Közös mobilnavigáció

Minden felület alján 4 gyorselérés + **Menü** található (összesen 5 gomb). A Menü kereshető, kategorizált, külön görgethető natív oldalsó panelt nyit; a hátralévő menüpontok és a kijelentkezés alul is elérhetők. A térkép helyett is felül jelenik meg a natív felület, nincs webes z-index-ütközés.

| Szerepkör | Alsó gyorselérések |
|---|---|
| Gazdálkodó | Főoldal · Táblák · Napló · Teendők · Menü |
| Szaktanácsadó | Kezdőlap · Ügyfelek · Napi munka · Térkép · Menü |
| Rendszeradmin | Kezdőlap · Ügyek · Fiókok · Biztonság · Menü |

A menünek 18 gazdálkodói, 23 szaktanácsadói és 6 admin első szintű célpontja van; a további mélyoldalak az adott listaelem/dosszié részletéből érhetők el a későbbi modulfejlesztések során.

## Mi valós és mi még nem?

### 2026. november 20. – menüfunkciók összekötése

- A natív szaktanácsadói **ügyféldosszié** a gazdálkodó gazdaságait, tábláit, utolsó szemléit és nyitott/lejárt feladatait mutatja. Az ügyféllista, a **prioritások**, az **elérhetőségek** (telefon/e-mail) és a **munkatársak** valódi, jogosultságvédett adatokra épülnek.
- A **munkanap** hétnapos feladat-, visszaellenőrzés- és tervezett látogatásnézetet ad, budapesti időzónával. A **szemlézési szezonok** gazdaságonként megtekinthetők és menthetők azonos eseményformátumban, mint a weben; a kliens ellenőrzi a mentés tényleges eredményét.
- A **határjavaslatok** natív képernyője a régi/javasolt poligon összehasonlítását és kifejezett döntési megerősítést követel; az elbírálás kizárólag a meglévő szerveroldali, versenyhelyzetet ellenőrző `review_field_boundary_proposal` RPC-n fut. A **térképi minőség** nézet jelzi a hiányzó pontot, a csak-pont állapotot, a hibás poligont és a közelítő területeltérést. Ez az Android-ellenőrzés **nem** végez szomszédos táblák közötti teljes átfedésvizsgálatot, és nem hiteles földmérés.
- A natív **növényvédelmi katalógusállapot** tényleges HU/SK készítményszámot, engedélyezett felhasználási lefedettséget és importnaplót olvas. A hiányzó HU dózist nem pótolja találgatással.
- A **GeoJSON / SHP ZIP tömeges import**, a **hivatalos növényvédelmi CSV/XLSX szinkron**, a **HungaroMet kézi szerver-szinkron** és a **friss MFA-t igénylő teljes adatbázis-export** továbbra is a meglévő webes kezelőfelület védett műveletei. Androidon ezekhez tájékoztató/kapcsolódó natív nézet van, nem egy második, gyengébben ellenőrzött import- vagy exportútvonal. A korábbi `/admin/portfolio` és `/admin/backup` aliasokat a webes navigációval egyezően kezeli.

**Kiadási kapuk:** a natív Kotlin-teszt és debug összeállítás nem helyettesíti a valódi három szerepkörös, kamerás/GPS-es, megszakadó hálózatos készülékpróbát. Az alább részletezett, még nem alkalmazott adatbázis-migrációk és a tartós, megfelelően védett Android aláírókulcs nélkül végleges APK nem adható ki.

**Elkészült forráskódszinten:** projektváz, Android app ikon és név, natív Compose menü/drawer/alsó sáv, a 3 szerepkör színvilága, Supabase-jelszavas belépési útvonal, profilalapú szerepkörválasztás, emelt jogosultságú TOTP-ellenőrzési út, titkosított munkamenet-helyreállítás és automatikus tokenmegújítás, kijelentkezés. A gazdálkodói **kezdőlap**, táblalista, tábla alap-részletnézete, a gazdaság teendői és műveleti naplója **valódi, RLS-es REST-olvasási lekérésekhez** van kötve, betöltési/újrapróbálási állapottal. A kezdőlap összesíti az aktív táblákat, az összterületet, a nyitott és lejárt teendőket, a kritikus szemléket és a következő feladatokat. A teendők között a gazda a munkatársaknak kiosztott, RLS szerint elérhető feladatokat is látja; a beküldött feladatot nem számoljuk az elvégzendő, lejárt munkák közé. A táblalistában figyelmeztető színű keretek vannak. RLS-es natív olvasóképernyő készült a **gazdaságok, gépek, munkatársak, idővonal, értesítések, szaktanácsadói üzenetek, dokumentumok, számlák** adataihoz. Az értesítések olvasottnak jelölhetők, a saját profil alapadatai szerkeszthetők, a dokumentumok rövid életű aláírt hivatkozással külső megjelenítőben megnyithatók. A Mai prioritások és Munkaterület külön szűréssel a megfelelő teendőket mutatja. A munkakiosztás képernyőn a jogosult gazdasági tulajdonos vagy vezető megbízható kérésazonosítóval rögzíthet új táblához kötött feladatot, és megpróbálja létrehozni a kapcsolódó naplóbejegyzést. A jelenlegi Supabase jogosultságpolitika a gazdálkodói értesítés-INSERT-et nem engedi, ezért az app itt nem próbál jogosulatlan üzenetet írni: a munkatársat külön kell értesíteni. E-mail-értesítés és gépkiosztás ezen az oldalon még nincs. A saját, gazdaságszintű **általános teendő** szöveges beszámolóval a szerver ellenőrzött `submit_general_task_execution` RPC-jén beküldhető; a szaktanácsadó az ilyen riportot megtekintés után az ellenőrzött `review_task_execution` RPC-vel jóváhagyhatja vagy javításra visszaküldheti. A földtáblás munkák továbbra is GPS-igazolást és teljes, webes szakmai ellenőrzést igényelnek. Más műveletek, gazdaságok és gépek alapvetően megtekinthetők, nem hozhatók létre vagy módosíthatók ezen a mobilfelületen.

**Szaktanácsadói és rendszeradmin-nézetek forráskódszinten:** szaktanácsadói áttekintés, ügyfélprioritási lista és feladatlista, a szemlék, bejelentések, tervezett látogatások, műveletek, dokumentumok, gépek és idővonal alapvető olvasóképernyői; rendszergazdai áttekintés, felhasználók, támogatási teendők és biztonsági események megtekintése. A gazdálkodói és szaktanácsadói térképen natív MapLibre-megjelenítő mutatja az RLS szerint látható földtáblák valódi GeoJSON poligonjait, OpenFreeMap/OpenStreetMap vektoros alaptérképen; a műholdréteg még nincs bekötve. Ezek a mobilképernyők **nem** használhatnak szerveroldali `service_role` kulcsot. A webes rendszeradmin némely adatlekérése csak emelt szerveroldali hozzáféréssel működik, ezért a natív REST-lekérés jogosultsághiány esetén hibaüzenettel áll meg. A teljes admin adatkapcsolathoz a későbbiekben külön, hitelesített szervervégpontok szükségesek. **A nézetek még nincsenek éles fiókkal tesztelve.**

**Még hátra van a végleges kiadáshoz:** a térkép és az összes natív adatfolyam készüléktesztje, konfigurált éles Supabase-fiókos E2E ellenőrzés; a teljes táblarészlet összes adatkártyája és natív műholdas térképréteg; a további teendő- és művelet-munkafolyamatok a webes üzleti szabályok szerint; a még hiányzó szaktanácsadói és admin munkafolyamatok és hitelesített backend-végpontok; meghívók és jelszó-visszaállítás mobil deep linkjei; hozzáférhetőségi és kiadási tesztek. A bejelentésírás, a szaktanácsadói válaszadás és a dokumentumfeltöltés már natív forráskódszinten létezik, de ezek teljes éles E2E próbája is hátravan. A generikus képernyők egyértelműen jelzik a hiányzó modulbekötést. **A jelenlegi forrás nem végleges kiadás.**

A bemutató mód kizárólag **nem konfigurált debug** buildben érhető el, benne kizárólag kitalált mintaadatokkal. Konfigurált debug és release build mindig a valódi bejelentkezést használja.

## Fejlesztés alatt: földtáblás feladat GPS-es igazolása

A natív képernyő a saját földtáblás feladathoz friss GPS-mérést kér (legfeljebb 15 perc, legfeljebb 200 méteres pontatlanság), teljes felbontású helyszíni JPEG-fotót készít, majd tényleges dózis, terület, mennyiség, időjárás, megjegyzés és opcionális gépüzemóra rögzítését teszi lehetővé. Előzetesen ellenőrzi a táblapoligont és a kizárt belső területeket; a fotó a meglévő, jogosultságvédett Supabase Storage-ba kerül. A végső validáció a szerver feladata.

**Biztonsági élesítési feltétel:** a `supabase/migrations/20261119110000_verified_task_proof_rpc_guard.sql` migráció még csak előkészített, éles alkalmazása külön ellenőrzést igényel. Az Android a vele együtt települő `verified_task_proof_policy_version()` jelzőt ellenőrzi. A jelző hiányában nem tölti fel a fényképet, nem hívja a korábban kevésbé szigorú RPC-t, és egyértelmű hibaüzenettel leáll. Az új RPC a GPS/idő/koordináta, a Storage-fotó, a geometriák, a jogosultság és a növényvédelmi megfelelőség ellenőrzését is szerveroldalon megismétli. Valódi készülékes, jogosultságos és fényképes teszt még szükséges; nincs kész végleges APK.

### Szaktanácsadói feladat-ellenőrzés

A meglévő szaktanácsadói munkalista most már az RLS szerint megtekinthető földtáblás teljesítések részletes adatait is betölti: GPS-fix (koordináta, mérési idő, pontosság, táblahatár-validáció), terv, tényleges dózis/terület/mennyiség, időjárás, üzemóra és megjegyzés. A helyszíni fotóhoz a szerver legfeljebb 60 másodperces aláírt hivatkozást ad, amely kizárólag a jogosult felhasználó nevében kérhető. Jóváhagyás csak valóban tárolt, helyes feladathoz/végrehajtóhoz kötött igazolással, a fotó megnyitása és a felhasználó kifejezett ellenőrzési megerősítése után érhető el. Hiányzó/beteg GPS-fotó igazolásnál az app csak javításra visszaküldést tesz lehetővé. A tényleges jóváhagyás a szerver jogosultságellenőrző `review_task_execution` RPC-jén történik, és az elfogadott strukturált műveletet a szerver írja a műveleti naplóba. A végrehajtónak az adatbázis által engedélyezett értesítést próbál küldeni; az értesítés hibája nem állítja vissza a már mentett döntést. Éles szerepkörös ellenőrzés még szükséges.

### Gazdálkodói bejelentés és szaktanácsadói válasz

A gazdálkodó a natív **Üzenetek** felületen saját földtáblát választva kategorizált, fontossággal ellátott szöveges szakmai jelzést küldhet. Csak a felhasználó tulajdonában lévő gazdaság táblái választhatók, és a Supabase RLS újra ellenőrzi ezt mentéskor. A mentés kérésazonosítóval védi az újrapróbálást a duplikált jelzéstől, az értesítés pedig az engedélyezett `notify_advisors` RPC-n fut. Bizonytalan értesítési állapot esetén a bejelentés megmarad, nem jön létre automatikusan még egy.

A szaktanácsadó a natív **Bejelentések** oldalon szűrheti, olvashatja, megválaszolhatja és lezárhatja a hozzáférhető jelzéseket. A válasz az eredeti rekord `updated_at` változatát ellenőrzi, így egy közben módosult ügyet nem ír felül vakon. A döntés után az idővonal és a gazdálkodói belső értesítés a már rögzített döntéstől elkülönülten készül. **Még hiányzik** a válasz mellé automatikusan kiosztott teendő és az e-mailes kézbesítés teljes mobilos funkciópróbája.

**Natív képek és videók:** a gazdálkodó a rendszer fénykép-/videóválasztójából legfeljebb 10 csatolmányt adhat a bejelentéshez, és a kamerával is készíthet helyszíni JPEG-fotót. A kliens a jelenlegi privát `farmer-report-media` vödörrel egyező 50 MB/fájl és MIME-korlátokat ellenőrzi, majd az Android `ContentResolver` adatait kisebb blokkokban streameli a Storage-ba. A megkezdett bejelentés azonosítója és a feltöltött/kapcsolt fájlok állapota egy futó munkameneten belüli újrapróbáláshoz megmarad; kétes hálózati válasz után a szerveroldali fájl és kapcsolati rekord létét külön ellenőrzi. A gazdálkodó és a szaktanácsadó a jogosultságvédett mellékleteket legfeljebb 60 másodperces aláírt hivatkozással nyithatja meg. Valódi, nagy fájlos, megszakadó hálózatos és többcsatolmányos készülékteszt még hátravan; a memóriában tartott újrapróbálási állapot a folyamat kilövésekor elvész.

### Natív dokumentumfeltöltés

A gazdálkodó a **Dokumentumok** és a **Számlák** oldalon a rendszer fájlválasztójával tölthet fel iratot a saját gazdaságához, opcionálisan földtáblához rendelve. A kategóriák, a PDF/JPG/PNG/WebP/DOC/DOCX MIME-lista és a 20 MB-os fájlméretkorlát megegyezik a webes dokumentumtárral és a már meglévő privát `documents` Storage-vödörrel. A kliens a feltöltés előtt és a szerver az RLS szabályokkal is ellenőrzi a tulajdonjogot. Egy futó alkalmazáspéldányon belül megőrzött dokumentumazonosító és Storage-útvonal teszi lehetővé a bizonytalan mentés biztonságos újrapróbálását, anélkül hogy a kliens új dokumentumot találna ki. Valódi fájlválasztós készülékteszt, megszakított feltöltés és folyamat-újraindítás utáni helyreállítás még hiányzik. A szaktanácsadói dokumentumfeltöltés és a törlési munkafolyamat nincs natívan implementálva.

### Gazdálkodói műveleti napló és jóváhagyások

A natív **Műveleti napló** háromlépéses, földtáblához kötött rögzítést ad a tulajdonosnak. Igazolt növényvédelmi felhasználásoknál (jelenleg főleg SK) megmaradt a hivatalos készítmény-/kultúra-/dózistartomány-ellenőrzés és a jogosult jóváhagyó. A HU katalógus nulla felhasználási sora mellett a **már ténylegesen elvégzett kezelés kézi, nem engedély-ellenőrzött naplózását** tesszük lehetővé: kötelező szer, kultúra, pozitív tényleges dózis, egység és a hatályos NÉBIH engedélyokirat külön ellenőrzésének megerősítése. A bejegyzés nem igazol kijuttatási engedélyt, dózishatárt vagy jogosultságot; a szerveroldali hatósági státusztiltás tovább él. A rendszer újrapróbálásnál ugyanazt a műveletazonosítót ellenőrzi, és az idővonalat is megpróbálja frissíteni.

**Magyar katalógus-adathiány:** a NÉBIH visszavont/lejárt készítmény-listájának szinkronja csak a terméktörzset és hatósági státuszokat tölti fel, nem a kultúra–cél–dózis engedélyadatokat. A közös adatbázis ellenőrzésekor 578 `active` HU terméket, de **0 HU felhasználási rekordot** találtunk; az `active` nem bizonyít érvényes kijuttatási engedélyt. A kézi napló nem gyárt hivatalos dózist. A `20261120110000_manual_hu_spraying_log_guard.sql` migráció a kézi naplót szerveroldalon is megkülönbözteti és kiküszöböli a régi szerneves automatikus termékazonosító-hozzárendelést; **a migráció éles alkalmazása és az összekapcsolt HU/SK készülékes végponttól végpontig teszt még hátravan**. A gazdasági vezető/munkatárs szerepkörök kliensoldali műveletrögzítése is hátravan, mivel az éles RLS jelenleg tulajdonosi INSERT-et enged.

A natív **Jóváhagyások** menüpont a felhasználóhoz rendelt, jóváhagyásra váró vagy már elfogadott növényvédelmi műveleteket mutatja. A felhasználó kifejezett megerősítése után előzetesen ellenőrzi az aktív gazdasági jóváhagyói kijelölést, a személyes érvényes növényvédelmi engedélyt és az I./II. kategóriához szükséges jogosultsági szintet; a szerver RLS/trigger ugyanezt a döntést újra ellenőrzi. A PATCH a művelet előző `updated_at` értékéhez és `pending` állapotához kötött. Valódi jóváhagyói fiókkal végigvezetett E2E teszt még szükséges. A kód és automatizált egységtesztek önmagukban nem helyettesítik ezt.

## Fordítás Android Studióban

Szükséges: JDK 17, Android SDK 36, Android Studio, internet a Gradle-függőségek első letöltéséhez.

1. Nyisd meg a `AgrarMentor-Android` mappát Android Studióban.
2. Az alkalmazásnak a meglévő Supabase-projekt **publikus** URL-je és **publishable** API-kulcsa szükséges. Ezt a saját géped `<felhasználó>/.gradle/gradle.properties` fájljában vagy biztonságos CI-környezetben add meg (ne töltsd fel GitHubra):

   ```properties
   AGRAR_SUPABASE_URL=https://<projekt-azonosító>.supabase.co
   AGRAR_SUPABASE_PUBLISHABLE_KEY=<nyilvános-publishable-kulcs>
   ```

   **Soha ne használj `service_role` vagy secret API-kulcsot az Android-kliensben.**
3. Windows PowerShellben a projekt gyökeréből:

   ```powershell
   .\gradlew.bat testDebugUnitTest
   .\gradlew.bat assembleDebug
   ```

4. A debug APK várt útvonala: `app/build/outputs/apk/debug/app-debug.apk`.

**A helyi környezetben nincs telepített Android SDK vagy Gradle-disztribúció.** A meglévő GitHub Actions fejlesztői ágán automatizált teszt és konfigurálatlan debug APK-fordítás fut. A demó APK nem végleges kiadás; a tényleges kiadáshoz konfigurált build és készülékpróba szükséges.

**Release-környezet ellenőrzése (2026-11-20):** az élő GitHub-tárolóban jelenleg csak `Preview` és `Production` environment található. A kiadáshoz külön `agrarmentor-release` environment kell, kötelező jóváhagyóval. A release workflow most már ennek meglétét futás közben is ellenőrzi, és hiányában megszakítja a kiadást. A tartós aláírókulcsot a felhasználónak biztonságosan meg kell őriznie; sem a kulcsot, sem a jelszavát nem tesszük a forráskódba vagy az APK mellé.

### Végleges, aláírt Android APK kiadása

A `.github/workflows/agrarmentor-android-release.yml` **kizárólag kézzel indítható** a `agrarmentor-release` GitHub Environment jóváhagyási kapuján keresztül. A munkafolyamat elutasítja a fejlesztői verziónevet, a hiányzó éles Supabase-konfigurációt és az aláírás nélküli APK-t. Sikeres natív teszt és `apksigner verify` után csak az aláírt release APK-t teszi letölthetővé (30 napig). Az alkalmazás csomagazonosítója továbbra is `hu.agrarmentor.android`.

A GitHub Environment beállításai: `AGRAR_SUPABASE_URL` és `AGRAR_SUPABASE_PUBLISHABLE_KEY` **nem titkos változóként**; `AGRAR_RELEASE_KEYSTORE_BASE64`, `AGRAR_RELEASE_STORE_PASSWORD`, `AGRAR_RELEASE_KEY_ALIAS` és `AGRAR_RELEASE_KEY_PASSWORD` **titkos változóként**. Az aláírókulcsnak tartósnak kell maradnia: elvesztése esetén a már telepített alkalmazás ugyanazzal a csomagazonosítóval nem frissíthető ugyanazzal az aláírással. Az aláírókulcsot **soha ne töltsd fel a nyilvános GitHub-tárolóba vagy az APK mellé**. Az Android `version_code` minden kiadáskor növekedjen. Jelenleg nincs kiadási aláírókulcs beállítva, a workflow még nem futott, és nincs ellenőrzött végleges APK.

**Kézi HU naplózás kiadási zár:** a natív és webes kliens a `hu_manual_spraying_policy_version()` **2-es verziójú** szerveroldali jelzőjét ellenőrzi. A `20261120110000_manual_hu_spraying_log_guard.sql` migráció telepítéséig a kézi naplózás letiltva marad, még akkor is, ha a HU engedélyezett felhasználási adatbázis üres. A migráció a gazda engedélyokirat-ellenőrzési megerősítését `permit_check_attested` mezőben és auditpillanatképben rögzíti; ez nem azonos hatósági ellenőrzéssel. Az adatbázis-migráció éles alkalmazása után is kötelező a jogosultságos, teljes folyamatú próba.
