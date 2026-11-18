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
