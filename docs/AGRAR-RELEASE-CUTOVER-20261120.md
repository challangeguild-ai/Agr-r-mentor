# AgrárMentor – összefüggő, ellenőrizhető kiadási terv

**Állapot: még NEM élesítve.** Az előkészítés és az előnézeti kódellenőrzés nem engedély az éles adatbázis vagy a `main` módosítására.

## 1. Valós állapot, 2026. november 20.

| Rész | Ellenőrzött tény | Kiadási következmény |
| --- | --- | --- |
| GitHub | A javítások a `fix/agrar-mentor-21-wizard-ux-hardening` ág **Draft PR #59**-ében vannak; a cél a 2.1-es feature ág, nem a `main`. | A Vercel Preview nem egyenlő a production kiadással. |
| Vercel-projekt | `infowaterk-5067` / `agr-r-mentor`, azonosító `prj_DMNfMt71StWzgb7rO839NUnrYEjS`. Production domain: `agr-r-mentor.vercel.app`. | Ne a Shoperation-projektet válasszuk. |
| Vercel env | `APP_PUBLIC_ORIGIN` **production** környezetben név szerint jelen van, **preview** környezetben nem. A Supabase URL és publishable key production/preview környezetben egyaránt szerepel. | A meghívó Previewban biztonságosan hibára fut. Csak a megfelelő Preview URL, Supabase Auth redirect allowlist és hozzáférési védelem ellenőrzése után szabad Preview értéket beállítani. |
| Supabase | Az AgrárMentor projekt `qkezhvtwirdsvhzjyvfi`; a szerver migrációtörténetének vége 2026.10.04. Az öt 2026.11.19-i migráció még függőben van. | A funkciók éles DB-végpontja még nem áll készen. |
| Edge Function | `invite-farmer` v9, `invite-advisor` v6, `send-notification-email` v5 volt aktív az ellenőrzéskor. | A Vercel-kódfeltöltés nem telepíti az új Supabase Edge Functionöket. |
| Helyi SQL-próba | Mind az öt migráció, jogosultsági és e-mail-korlát teszt átment a visszaállított Docker-adatokon; `ROLLBACK` megtörtént. | Az adatbázis-változások valós helyi PostgreSQL-en ellenőrzöttek, élesben nem alkalmazottak. |
| Supabase Auth SMTP | 2026.11.20-án a dashboardon az egyedi SMTP **bekapcsolva**, szolgáltató `smtp.resend.com`, port `465`, feladónév „Agrár Mentor”; a jelszó rejtett, tényleges kézbesítés nem próbált. | Konfiguráció jelen van, de éles kézbesítés külön bizonyítandó. |
| Resend | A `notify.waterk.hu` küldődomain **verified**, a `mail.waterk.hu` **not_started**. | Az értesítési feladóhoz a hitelesített domaint kell használni. |
| Auth Site URL | **JAVÍTVA 2026.11.20.** A hibás `https://agr-r-mentor.vercel.app/**` helyett a tárolt Site URL `https://agr-r-mentor.vercel.app`, mentés és újratöltés után ellenőrizve. Az allowlistben `https://agr-r-mentor.vercel.app/**` és `https://agr-r-mentor.vercel.app/reset-password` maradt. | Az éles meghívó-/bejelentkezési eredet alapértéke megfelelő; a valódi meghívási próba még hiányzik. |
| Edge titkok | **JAVÍTVA 2026.11.20.** A meglévő `RESEND_API_KEY` és `APP_PUBLIC_ORIGIN` mellé létrejött a `NOTIFICATION_EMAIL_FROM` = `Agrár Mentor <noreply@notify.waterk.hu>`; a Supabase sikeres létrehozást jelzett. | A hibás feladó-fallback megszűnt a Draft kódban; kézbesítés és Edge-funkciók új telepítése még nem igazolt. |
| Friss mentés | A Free csomag dashboardja jelzi: nincs automatikus projektmentés. A 2026.11.19-i Windows Docker-mentés helyreállítási próbája sikeres volt, de a mentés kora élesítés előtt frissítendő. Készült egy **csak olvasó**, pontos Supabase-projektre célzó, felülírásmentes Windows-segédscript. | Az adatbázis-migráció előtt **friss, ellenőrzött mentés** szükséges. |
| Jelenlegi adatmennyiségek | 2026.11.20-án olvasó SQL-ellenőrzés: `auth.users=4`, `public.tasks=12`, `public.field_operations=9`, `public.inspections=7`, `storage.objects=2`; a legutóbbi Storage-metaadat frissítés 2026.10.04. | A darabszámok a korábbi helyi visszaállítás eredményével egyeznek, **de ez nem bizonyítja a sorok teljes változatlanságát**. |

## 2. Forráscsomag és célprojekt-ellenőrzés

Futtatható, **csak olvasó** ellenőrzés:

```bash
npm run release:check
```

Az ellenőrzés a `scripts/release-targets.json` alapján a helyes GitHub/Vercel/Supabase célokat, az öt migráció sorrendjét, a kizárólag helyi `ROLLBACK` próbát és a három egyező Edge Function-kódot vizsgálja. Részletes, SHA-256 fájlazonosítós kiadásmanifest:

```bash
node scripts/release-contract.mjs --json
```

**Ez a program nem telepít, nem kér kulcsokat, és nem olvas `.env` fájlokat.** A távoli konfiguráció jelenlétét az illetékes Vercel/Supabase felületeken külön kell ellenőrizni; a csomagellenőrzés nem helyettesíti ezt.

### Friss adatbázis-pillanatkép – egyetlen Windows-parancs

A legújabb Draft forráscsomag gyökerében, **bejelentkezett Supabase CLI-vel és futó Docker Desktoppal**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Backup-AgrarMentor-Predeploy.ps1
```

A script **kifejezetten** a `qkezhvtwirdsvhzjyvfi` production projektet célozza (`--remote=qkezhvtwirdsvhzjyvfi`, Supabase CLI 3.2.0), és kizárólag olvas. Minden futás új mappát készít a felhasználói profil alatti `AgrarMentor-friss-mentesek` könyvtárban; a régi mentést nem írja felül. Az új `roles.sql`, `schema.sql`, `data.sql` mellett `manifest.json` készül SHA-256 fájlhash-ekkel, COPY-blokk ellenőrzéssel és a kritikus táblák sorainak számával. Hiányzó Auth/Storage-metaadat, rövid vagy megszakadt dump esetén **hibát jelez**.

**Korlát:** az SQL-dump **nem** tartalmazza a Supabase Storage-objektumok tényleges bájtjait. A 2026.11.19-i külön Storage-mentést meg kell őrizni, az új mappát tőle függetlenül. A friss SQL-dumpot éles migráció előtt helyi visszaállítási próbával is ellenőrizni kell; a puszta fájlellenőrzés nem bizonyít teljes visszaállíthatóságot. A script **nem** futtat migrációt, nem állít vissza adatbázist, és nem telepít semmit.

## 3. Egyetlen, összehangolt élesítési sorrend – csak külön jóváhagyás után

1. **Záró pillanatkép:** ellenőrizni, hogy a production Supabase még mindig az előre ismert projekt, az öt migráció még függőben van, a korábbi production Vercel-kiadás és mindhárom Edge Function visszaállítható. A **régi** mentés megvan; a friss pillanatképet és annak visszaállíthatóságát az éles migráció előtt külön igazolni kell.
2. **Konfiguráció:** **az Auth Site URL és a `NOTIFICATION_EMAIL_FROM` már javítva.** A production `https://agr-r-mentor.vercel.app` eredetet még egyeztetni kell a meglévő Supabase Edge `APP_PUBLIC_ORIGIN` *tényleges értékével* (a secret neve látható, az értéke rejtett). A Supabase Auth SMTP jelenlétét igazoltuk, a kézbesítését még nem. A hosszú Preview alias nem az éles meghívók célcíme.
3. **DB:** az öt validált migrációt az előre rögzített sorrendben alkalmazni, és minden RPC/RLS jogosultságát ellenőrizni. **Ne** töltsünk fel új Edge Functiont a kvóta-függvények DB-létrehozása előtt.
4. **Három Edge Function együtt:** `invite-farmer`, `invite-advisor`, `send-notification-email` és közös `_shared` moduljaik ugyanabból a jóváhagyott git commitból kerüljenek ki. A Supabase-ben `verify_jwt=true` maradjon; minden visszaválasz `X-AgrarMentor-Email-Release: 2026-11-20-email-v1` revízióazonosítót tartalmazzon.
5. **Valódi integrációs próba:** tesztfiókokkal meghívó, aktiválás, gazdálkodó ↔ szaktanácsadó, gazda → munkatárs, szemle és munka leadása; kézbesítés és link működésének ellenőrzése, jogosulatlan célcím és duplázás elutasítása. Nem tesztelünk véletlenszerű valódi felhasználók címére.
6. **Vercel production:** csak a sikeres integrációs próbák után a jóváhagyott feature/Draft PR-láncon keresztül hozzuk a végleges kódot a megfelelő production ágra. Ne történjen véletlen Preview-promóció vagy Shoperation-csapatválasztás. A domain és a tényleges production build SHA utóellenőrzése kötelező.
7. **Felügyelet:** Edge/Resend/Supabase Auth hibák, Vercel build- és runtime-logok; rendszeradmin/gazdálkodó/munkatárs szerepkörű kézi smoke-test, mobilon is.

## 4. Megállási és visszaállítási szabályok

- A kiadást **meg kell állítani**, ha az eredetcím, Auth redirect allowlist, SMTP/Resend-küldő vagy célprojekt nem bizonyítottan helyes.
- Kódhibánál a Vercel korábbi production telepítése és a három Edge Function korábbi változata célzottan visszaállítható. Az Edge-függvények előző forrását az élesítés előtt külön meg kell őrizni.
- **Adatbázis-migrációt nem lehet automatikusan, vakon „visszagörgetni”** egy már használatban lévő éles adatbázison. Ha éles DB-hiba jelentkezik, először állítsuk le az érintett írásokat, mérjük fel az esetleges új adatokat, és csak adatvesztési kockázatot értékelő tervvel állítsunk vissza.
- A jóváhagyott helyi próba `ROLLBACK`-je **nem** egy éles visszaállítási terv, és nem jelenti, hogy az öt migráció productionben már megtörtént.

## 5. Lezárási feltételek

Csak akkor mondható, hogy az egész kiadási csomag élesben kész, ha **mind az öt DB-migráció alkalmazva**, a **három Edge Function új revízióval igazoltan fut**, a **Vercel production a jóváhagyott SHA-t szolgálja ki**, a **küldőbeállítások és valódi címzettől érkező e-mailek** ellenőrzöttek, és a **fő gazdálkodói, munkatársi, szaktanácsadói folyamatok** kézi próbája sikeres.
