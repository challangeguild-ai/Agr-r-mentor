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
| Kézbesítés | Supabase Auth SMTP beállítás, Resend-küldődomain SPF/DKIM/DMARC és tényleges címzetti kézbesítés ezen ellenőrzésben nem igazolt. | Nem állíthatjuk, hogy az e-mailmodul már élesben működik. |

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

## 3. Egyetlen, összehangolt élesítési sorrend – csak külön jóváhagyás után

1. **Záró pillanatkép:** ellenőrizni, hogy a production Supabase még mindig az előre ismert projekt, az öt migráció még függőben van, a korábbi production Vercel-kiadás és mindhárom Edge Function visszaállítható. A biztonsági mentés megvan; migráció előtt a mentés időpontját és visszaállíthatóságát külön megerősíteni.
2. **Konfiguráció:** rögzíteni a végleges production HTTPS eredetcímet. Egyeztetni Vercel `APP_PUBLIC_ORIGIN`, Supabase Edge `APP_PUBLIC_ORIGIN`, Auth `Site URL` és `Redirect URLs`; az e-mail küldődomaint, Supabase Auth SMTP-t és a Resend titkot. A jelenlegi, hosszú Preview alias önmagában nem alkalmas az éles meghívók célcímének.
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
