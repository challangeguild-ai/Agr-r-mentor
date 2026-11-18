# Agrár Mentor 2.1 – wizard és UX javítások: ellenőrzési terv

## Változások
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
