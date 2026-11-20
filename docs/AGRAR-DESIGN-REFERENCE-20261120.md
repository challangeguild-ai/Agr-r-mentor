# AgrárMentor – elfogadott portál-arculat, 02–07 képernyő

**Forrás:** a tulajdonos által 2026.11.20-án a beszélgetésben ismét elküldött, hat modulból és modulonkénti mobilos mintákból álló referencia-montázs. **Ez az elfogadott dizájnirány**, nem új arculatterv. A képfájlt nem töltöttük fel a nyilvános GitHub-tárhelyre.

## Közös arculati alapszabályok

- Sötét smaragdzöld navigáció, élénkebb zöld aktív menüpont és elsődleges akciók; világos krém/fehér fő tartalom.
- Lekerekített, visszafogottan keretezett kártyák; vékony elválasztók; tiszta, kompakt adatsorok.
- Növény- és táblastátuszok színkódja: zöld = jó/aktív, sárga = figyelmet igényel, piros = kritikus/késedelmes.
- Az asztali képeken oldalsáv és felső kereső/profil sor. Mobilon az oldalsáv fiókként nyílik; a kulcstételek kártyává alakulnak; a kezelőelemek érinthető méretűek.
- A referenciában megjelenő nevek, hektárszámok, százalékok és események **demóadatok**: az alkalmazásban kizárólag a valós, jogosult adatbázis-eredmény jelenhet meg. Hiányzó adatból nem képezünk fiktív értéket.

## Megfeleltetés és végrehajtott egységesítés

| Minta | Valós alkalmazás | 2026.11.20-i dizájnmunka |
| --- | --- | --- |
| 02 Táblák | `/fields` | Működő térkép/lista kapcsoló `mode=map/list` URL-lel; a kiválasztott állapotszűrő megmarad. Mobil alapértelmezés a lista, külön térképnézettel. Valós térképi miniatűr és állapotkártyák. |
| 03 Tábla részletek | `/fields/[id]` | Áttekintés, műveletek, időjárás, talaj/növény, dokumentumok, térkép fülek; 4 adatcsempe és állapotpanel; megszüntetett, adatból nem számolt „72/48/24%” állapotpontszám. |
| 04 Műveleti napló | `/operations` | Egységes, asztalon táblázatos, mobilon átlátható kártyás megjelenés; valódi műveletek, anyagok, dózisok és jóváhagyási állapotok. A műveletrögzítő űrlap működése érintetlen. |
| 05 Teendők | `/tasks` | Állapotszűrők, prioritásjelzések, új teendő navigáció a működő `/dispatch` munkakiosztóhoz; a tényleges beküldés/jóváhagyás kártyái megmaradtak. |
| 06 Üzenetek | `/messages` | Kétoszlopos beszélgetésnézet és mobilos lista/részlet váltás; olvashatóbb beszélgetések. A referencia szabadon beírható chatüzenetét nem imitáljuk, mert a rendszer jelenleg hiteles földtáblabejelentéseket és tanácsadói válaszokat kezel. |
| 07 Dokumentumok | `/documents` | Kategória, keresés, kapcsolódó egység, táblázat és mobilos fájlkártyák; működő megnyitás, törlés, feltöltés. |

**Közös keret:** `components/Sidebar.tsx`, `components/FarmerSidebar.module.css`, `components/FarmerTopbar.module.css`, a modulok CSS-állományai és a `portal-final.css` már a meglévő dizájnt viszik tovább. Az oldalsáv a referencia színrendszerét, dekoratív tájhorizontot és profil-láblécet kapott, működő navigációk elvesztése nélkül.

**Második, kiegészítő egységesítési kör:** a felső keresősáv a képernyőhöz illő keresőszöveget jeleníti meg, és telefonon is jól használható méretű; a profil és az értesítési központ kártyái, szövegei és gombjai a hat fő mintaképernyő méretarányaihoz igazodnak. A napi munkaközpont mobilos összesítői, valamint a régebbi gazdálkodói űrlapok, statisztikák és fókuszjelzések is azonos ritmust kaptak. A földtábla állapotjelzője szemle nélkül **semleges**, nem zöld „jó” állapotot sugall. Ezek megjelenési finomítások: a működő jogosultságokat, adatokat, műveleteket és szerepkörönként eltérő profilszíneket nem írják át.

**Mobilos záróellenőrzés:** a Műveleti napló CSV-exportja nem tűnhet el a kis kijelzőn, ezért a régi elrejtést felülbíráltuk. A mobil oldalsáv bezáró-, navigációs és súgóelemei nagyobb, legalább 44 pixeles érintési célokat és olvashatóbb feliratokat kaptak.

## Amit még élő, bejelentkezett vizuális ellenőrzés követ

1. Referenciával összevetett teljes asztali nézet legalább 1280 px tartalmi szélességen: az oldalsáv, a földtábla térkép és minden valódi adatmező.
2. Mobilon 360/390/430 px: térkép/lista kapcsoló, hosszú földtáblanév, összetett műveleti sor, dokumentum/feltöltés, beszélgetés visszanavigálás, oldalsáv görgetés.
3. Bejelentkezett farmer/munkatárs szerepkörrel az összes 02–07 útvonal megnyitása a Vercel Previewban. A build és az automatizált tesztek **nem helyettesítik** a tényleges böngészős megtekintést.
   - 2026.11.20.: a Preview elkészült, de a külső vizuális ellenőrzést a Vercel Authentication belépési kapuja megállította. Ezt a fennmaradó QA-feladatot nem tekintjük elvégzettnek.
4. A referencia 01-es (áttekintő dashboard) képe **nem szerepelt** ezen a hatképernyős montázson; a már elkészült dashboardot változatlanul őrizzük, amíg a hozzá tartozó elfogadott minta is rendelkezésre nem áll.

**Kiadási határ:** ezek a módosítások kizárólag a Draft javítási ágon vannak. Supabase migráció vagy Vercel production élesítés ezzel nem történt.
