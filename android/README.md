# Agrár Mentor – natív Android-alkalmazás

**Egyetlen Android-alkalmazás, egyetlen csomagazonosító:** `hu.agrarmentor.android`.

Ez külön Kotlin / Jetpack Compose projekt. **Nem WebView**, nem a honlap mobilmenüjének átírása, és nem három külön telepítendő alkalmazás. Az Agrár Mentor meglévő Supabase backendjét használja; a Next.js/Vercel projektet változatlanul hagyja.

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

**Elkészült forráskódszinten:** projektváz, Android app ikon és név, natív Compose menü/drawer/alsó sáv, a 3 szerepkör színvilága, Supabase-jelszavas belépési útvonal, profilalapú szerepkörválasztás, emelt jogosultságú TOTP-ellenőrzési út, titkosított munkamenet-helyreállítás és automatikus tokenmegújítás, kijelentkezés. A gazdálkodói **kezdőlap**, táblalista, tábla alap-részletnézete, a gazdaság teendői és műveleti naplója **valódi, RLS-es REST-olvasási lekérésekhez** van kötve, betöltési/újrapróbálási állapottal. A kezdőlap összesíti az aktív táblákat, az összterületet, a nyitott és lejárt teendőket, a kritikus szemléket és a következő feladatokat. A teendők között a gazda a munkatársaknak kiosztott, RLS szerint elérhető feladatokat is látja; a beküldött feladatot nem számoljuk az elvégzendő, lejárt munkák közé. A táblalistában figyelmeztető színű keretek vannak. RLS-es natív olvasóképernyő készült a **gazdaságok, gépek, munkatársak, idővonal, értesítések, szaktanácsadói üzenetek, dokumentumok, számlák** adataihoz. Az értesítések olvasottnak jelölhetők, a saját profil alapadatai szerkeszthetők, a dokumentumok rövid életű aláírt hivatkozással külső megjelenítőben megnyithatók. A saját, gazdaságszintű **általános teendő** szöveges beszámolóval a szerver ellenőrzött `submit_general_task_execution` RPC-jén beküldhető; a szaktanácsadó az ilyen riportot megtekintés után az ellenőrzött `review_task_execution` RPC-vel jóváhagyhatja vagy javításra visszaküldheti. A földtáblás munkák továbbra is GPS-igazolást és teljes, webes szakmai ellenőrzést igényelnek. Más teendők, műveletek, gazdaságok és gépek alapvetően megtekinthetők, nem hozhatók létre vagy módosíthatók ezen a mobilfelületen.

**Szaktanácsadói és rendszeradmin-nézetek forráskódszinten:** szaktanácsadói áttekintés, ügyfélprioritási lista és feladatlista, a szemlék, bejelentések, tervezett látogatások, műveletek, dokumentumok, gépek és idővonal alapvető olvasóképernyői; rendszergazdai áttekintés, felhasználók, támogatási teendők és biztonsági események megtekintése. A szaktanácsadói térképfelület jelenleg figyelmeztetésekkel ellátott földtáblalista. Ezek a mobilképernyők **nem** használhatnak szerveroldali `service_role` kulcsot. A webes rendszeradmin némely adatlekérése csak emelt szerveroldali hozzáféréssel működik, ezért a natív REST-lekérés jogosultsághiány esetén hibaüzenettel áll meg. A teljes admin adatkapcsolathoz a későbbiekben külön, hitelesített szervervégpontok szükségesek. **A nézetek még nincsenek éles fiókkal tesztelve.**

**Még hátra van a végleges kiadáshoz:** az új kód Android buildje és készüléktesztje, konfigurált éles Supabase-fiókos E2E ellenőrzés; a teljes táblarészlet összes adatkártyája és natív műholdas térkép/poligonréteg; teendő és művelet létrehozása, kiosztása, jóváhagyása és lezárása a webes üzleti szabályok szerint; üzenet-/jelentésírás és dokumentumfeltöltés; a még hiányzó szaktanácsadói és admin munkafolyamatok és hitelesített backend-végpontok; meghívók és jelszó-visszaállítás mobil deep linkjei; hozzáférhetőségi és kiadási tesztek. A generikus képernyők egyértelműen jelzik a hiányzó modulbekötést. **A jelenlegi forrás nem végleges kiadás.**

A bemutató mód kizárólag **nem konfigurált debug** buildben érhető el, benne kizárólag kitalált mintaadatokkal. Konfigurált debug és release build mindig a valódi bejelentkezést használja.

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

**Jelen környezetben nincs telepített Android SDK vagy Gradle-disztribúció, ezért a natív kód még nincs lefordítva és APK sincs ellenőrizve.** A forrás csak a fordítás és készülékpróba után tekinthető telepíthető kiadásnak.
