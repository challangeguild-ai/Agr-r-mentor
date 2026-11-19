# Agrár Mentor – agrárgazdasági munkaközpont

Next.js és Supabase alapú, több jogosultsági szinttel működő agrárgazdasági alkalmazás.

> **Fejlesztési státusz (2026. november):** a fő `main` ágon lévő 2.0-s funkciók mellett a 2.1-es irányítópult és HungaroMet-időjárási modul **külön fejlesztési ágban**, a [#58 PR](https://github.com/challangeguild-ai/Agr-r-mentor/pull/58) alatt található. A wizardok és a mobilos UX további javításai [#59 PR](https://github.com/challangeguild-ai/Agr-r-mentor/pull/59). A Preview sikeres fordítása nem jelenti automatikusan az éles, szerepkörös végpontok tesztelését.

## Fő folyamatok

| Terület | Tudás |
| --- | --- |
| Gazdálkodó | gazdaságok, földtáblák, munkatársak, műveleti napló, gépek, teendők, munkakiosztás, térkép, dokumentumok, idővonal |
| Szaktanácsadó | ügyfélkezelés, gazdasági szemlék, szakmai visszajelzés, prioritások és napi munkaszervezés |
| Rendszeradmin | felhasználók, biztonsági felügyelet, támogatás és háttérfolyamatok |
| Növényvédelem | HU/SK készítmény- és felhasználásadatok, jóváhagyási és szerveroldali megfelelőségi szabályok |
| Vezetett folyamatok | műveletrögzítés és munkatárs-meghívás lépéses űrlappal; további műveletek súgóval és virtuális túrával |
| 2.1-es fejlesztési ág | „Mai munkaközpont”, valós munkastátuszok, 7/30 napos meteorológiai összesítések, HungaroMet-adapter |

Az időjárási adatok állomásmérések, **nem** a földtáblán végzett közvetlen mérések. A növényvédelmi katalógus döntéstámogatás: mindig a hatályos engedélyokirat, hatósági forrás és megfelelő jogosultság az irányadó.

## Helyi indítás

Node.js 22 használata ajánlott.

```bash
cp .env.example .env.local
npm install
npm run dev
```

A `.env.local` fájlban kizárólag a saját környezethez tartozó értékek szerepeljenek; **titkokat tilos GitHubra tölteni**. Az `.env.example` megadja a használt környezeti változókat, köztük:

- `NEXT_PUBLIC_SUPABASE_URL` és `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (csak szerver)
- `SECURITY_STEPUP_SECRET`, `CRON_SECRET` (csak szerver)
- `APP_PUBLIC_ORIGIN` – a jelenlegi frontend pontos HTTPS eredetcíme (meghívóhoz)

A meghívásokhoz és az e-mailes értesítésekhez azonos `APP_PUBLIC_ORIGIN` érték szükséges a Next.js környezetben, valamint az `invite-farmer`, `invite-advisor` és `send-notification-email` Supabase Edge Functionokban; a pontos `/invite` URL-t az Auth Redirect URLs listához is hozzá kell adni. Hiányzó beállításnál az e-mailes értesítés nem küldhető ki, nehogy régi oldalra mutasson. A régi Vercel URL nem helyettesítő alapérték.

## Ellenőrzés

```bash
npm test
npm run lint
npm run build
```

A `npm test` Node-alapú célzott regressziós teszteket futtat. Ezek **nem** helyettesítik a teljes bejelentkezett end-to-end tesztelést, az RLS/MFA ellenőrzést és az éles Supabase-integráció próbáját.

A manuális átvételi terv: [docs/AGRAR-2.1-UX-QA.md](docs/AGRAR-2.1-UX-QA.md).

## Biztonságos kiadás

1. A kívánt fejlesztési ág és a GitHub PR áttekintése.
2. Sikeres build, tesztek, majd Vercel Preview szerepkörös ellenőrzése.
3. Supabase-migrációk, Edge Function-ok és szerveroldali environment változók ellenőrzése.
4. Csak ezután jóváhagyott merge / élesítés.

**Élesadat-módosítás vagy automatikus PR-összevonás nélkül dolgozunk a javítóágon.**
