# Virtuális túra és blokk-súgó – frissítési audit (2026-11-21)

Az aktív, három szerepkörös virtuális túrát a jelenlegi **fejlesztői webfelület** moduljaihoz ellenőriztük. Az éles `main` ág régebbi felületet tartalmaz; a módosítások **nem éles adatbázis-migrációk és nem production deployok**.

## Frissített bemutató

- Gazdálkodó, **v17**: a mai munkaközpont, a tényleges állapotjelző kártyák, a szűrhető térkép/lista nézet, az üzenetek beszélgetésnézete és a lenyitható dokumentumfeltöltés aktuális leírásai. A földtábla-adatlapon látható 7/30 napos HungaroMet-csapadéknapló magyarázata különbséget tesz 0 mm és hiányzó mérés között.
- Szaktanácsadó, **v13**: a meglévő teljes körű szakmai túra végére bekerült a közös profil- és jogosultságadatok magyarázata.
- Rendszeradmin, **v8**: új HungaroMet-szinkron felügyeleti modul, az állapotadatok, a kézi futtatás hatásai és az importelőzmények bemutatásával; a profil itt is szerepel. A túra **nem indít szinkront**.
- A tényleges képernyőkön korábban hiányzó `data-help-block` jelölések: gazdálkodói kezdőlap, táblák, műveleti napló, teendők, üzenetek, dokumentumok, rendszeradmin áttekintés, továbbá az új időjárás- és profilblokkok.
- A túra kizárólag a **valóban megjelenő** modulblokkokat célozza: nem kattint mentésre, törlésre vagy jóváhagyásra, és nem módosít adatbázisrekordot.

## Automatikus és kézi ellenőrzés

- `node --test tests/comprehensiveTourCoverage.test.mjs`: minden túracélpont megvan az alkalmazás forrásában; minden hivatkozott útvonal létezik; mindhárom szerepkör valamennyi menüpontját lefedi a bemutató.
- A nyilvános Vercel-oldal 2026-11-21-én megnyílt, a belépés működő párbeszédablakot adott. **A bejelentkezés mögötti élő, háromszerepkörös kattintási próba továbbra is szükséges** tesztfiókokkal; a statikus célpontellenőrzés nem helyettesíti.
- A mérési adatok és a hivatalos növényvédőszer-katalógusok **tartalmát nem írtuk át**; azokat külön, jogosultsággal és forrásigazolással kell ellenőrizni és frissíteni.

## Korábbi munkák

A blokk-specifikus `i` súgók, a stabil célpontok és a korábban elkészült Mai prioritások, Gazdaságom, Munkakiosztás, Géppark, Idővonal és Számlák útmutatói továbbra is a teljes túra részei.
