# Agrár Mentor – hogyan védjük az adatokat? Közérthetően

Az Agrár Mentor olyan adatokat kezelhet, amelyek egy gazdaság napi működéséhez tartoznak: gazdaságok, földtáblák, szemlék, teendők, műveletek, dokumentumok, elérhetőségek és szakmai megjegyzések. Ezeknek valódi üzleti értékük van, ezért a rendszer védelmét több, egymásra épülő réteggel alakítjuk ki.

Fontos: nincs olyan internetes rendszer, amelyről felelősen ki lehetne jelenteni, hogy soha nem törhető fel. A célunk az, hogy az Agrár Mentor ne legyen könnyű célpont, és ha valaki megpróbál belenyúlni, lehetőleg ne jusson adathoz, a próbálkozás pedig maradjon nyoma a rendszerben.

## 1. Nem elég bejelentkezni – azt is ellenőrizzük, ki mit láthat

A rendszer nem úgy működik, hogy ha valaki egyszer belépett, akkor hozzáfér az egész adatbázishoz. Minden felhasználónak megvan a saját szerepe és jogosultsága.

Egyszerű példával: ha két gazdálkodó használja az Agrár Mentort, akkor az egyik gazdálkodó nem láthatja a másik földjeit, szemléit vagy dokumentumait csak azért, mert tudja vagy kitalálja azok azonosítóját.

Ezt nemcsak a weboldal kinézete védi. Maga az adatbázis is ellenőrzi, hogy az adott ember jogosult-e az adott adatsorra.

## 2. A fontos döntéseket nem bízzuk a böngészőre

A böngészőből érkező adatokat nem tekintjük automatikusan megbízhatónak. Egy ügyes támadó ugyanis meg tudja változtatni azt, amit a saját telefonja vagy számítógépe a szervernek küld.

Ezért az érzékeny műveleteknél a szerver újra ellenőrzi például:
- valóban be van-e jelentkezve a felhasználó;
- milyen szerepkörrel rendelkezik;
- ténylegesen hozzáférhet-e az adott gazdasághoz vagy földtáblához;
- megfelelő-e a beküldött adat.

Vagyis nem az számít, hogy a böngésző azt mondja: „én ehhez hozzáférek”, hanem az, hogy a szerver és az adatbázis is ezt állapítja-e meg.

## 3. A gazdaságok adatai el vannak választva egymástól

Az egyik legfontosabb védelmi réteg az úgynevezett RLS. Ezt úgy lehet elképzelni, mintha az adatbázisban minden adat előtt lenne egy külön biztonsági őr.

Amikor valaki adatot kér, az adatbázis megnézi: „ennek az embernek ehhez a konkrét adathoz van joga?”

Ha nincs, akkor az adatot nem adja oda akkor sem, ha valaki megpróbálja megkerülni a normál weboldalt és közvetlenül az adatbázis API-ját támadja.

## 4. A jelszó és a titkos kulcsok nem kerülhetnek ki a felhasználóhoz

Az alkalmazásban vannak nyilvános és titkos technikai kulcsok. A valóban érzékeny kulcsokat csak szerveroldalon szabad használni.

A rendszer fejlesztésénél külön szabály, hogy service-role vagy más erős jogosultságú secret ne kerülhessen bele a böngészőbe, a publikus JavaScriptbe vagy a GitHub repositoryba.

A biztonsági naplóba sem mentünk jelszót, session tokent vagy titkos API-kulcsot.

## 5. A feltöltött képek és dokumentumok is védett adatok

Egy szemlefotó vagy gazdasági dokumentum ugyanolyan érzékeny lehet, mint egy adatbázis-bejegyzés.

Ezért azt is ellenőrizni kell, hogy ki tölthet fel fájlt és ki töltheti le. Egy másik gazdasághoz tartozó felhasználó ne tudjon egy fájlt csak azért megszerezni, mert kitalálja a fájl nevét vagy elérési útját.

A feltöltéseknél méret- és fájltípus-ellenőrzés is szükséges, hogy a fájlfeltöltési lehetőségből ne lehessen támadási eszköz.

## 6. A böngészőt is védekezésre kérjük

Az Agrár Mentor speciális biztonsági HTTP fejléceket használ. Ezek többek között segítenek abban, hogy:
- más weboldal ne tudja észrevétlenül saját oldalába beágyazni az Agrár Mentort;
- a böngésző ne próbáljon veszélyes módon fájltípust kitalálni;
- HTTPS kapcsolatot használjon;
- idegen oldalak kevesebb információt kapjanak arról, honnan érkezett a felhasználó;
- a kamera és a GPS csak ott legyen használható, ahol az alkalmazásnak valóban szüksége van rá.

## 7. Figyeljük a gyanús viselkedést

A rendszerhez biztonsági eseménynapló készül. Ez nem azt jelenti, hogy minden normál kattintást figyelünk, hanem azt, hogy a biztonság szempontjából fontos vagy gyanús eseményeknek nyoma marad.

Ilyen lehet például:
- nagyon sok sikertelen belépési próbálkozás rövid idő alatt;
- valaki folyamatosan olyan gazdaság adatait próbálja megnyitni, amihez nincs joga;
- tiltott adminfunkciókat próbál hívni;
- rövid idő alatt szokatlanul sok exportot próbál indítani;
- sok hibás vagy tiltott művelet érkezik ugyanarról az IP-címről.

## 8. Nem egyetlen hibára riasztunk

Ha valaki egyszer rosszul írja be a jelszavát, attól még nem kezeljük hackernek.

A rendszer inkább mintát keres. Egy hiba csak kis kockázat. Sok egymást követő, hasonló gyanús esemény viszont egyre magasabb kockázati pontszámot kaphat.

Ha a rendszer szerint a viselkedés már valóban gyanús, akkor admin riasztást hozhat létre. Kritikus esetben e-mail is küldhető az adminnak.

Így a védelem a háttérben dolgozik, de nem akadályozza feleslegesen a normál gazdálkodót vagy szaktanácsadót.

## 9. Mit rögzítünk egy gyanús eseménynél?

Egy biztonsági eseménynél többek között rögzíthető:
- pontos időpont;
- IP-cím;
- ha ismert, melyik felhasználói fiókhoz kapcsolódott;
- milyen műveletet próbált végrehajtani;
- melyik oldalon vagy funkciónál történt;
- milyen böngészőből vagy eszköztípusból érkezett a kérés;
- milyen súlyosnak értékelte a rendszer;
- közelítő ország, régió vagy város az IP-cím alapján.

Az IP-alapú hely nem pontos GPS. VPN, mobilinternet vagy szolgáltatói hálózat miatt eltérhet a valós helytől. Ezért ez segítség az incidens vizsgálatához, nem biztos bizonyíték arra, hogy pontosan hol volt az illető.

Az IP-cím sem mondja meg önmagában, hogy ki ült a számítógép előtt. Komoly jogi ügyben a szolgáltató naplóira és hivatalos eljárásra is szükség lehet.

## 10. Ha valaki mégis bejutna, megpróbáljuk korlátozni a kárt

A biztonság nemcsak arról szól, hogy valakit megállítunk a bejáratnál. Arról is, hogy ha egy fiók vagy egy funkció mégis sérül, abból ne automatikusan az egész rendszer sérüljön.

Ezért van több külön védelmi réteg:
- felhasználói bejelentkezés;
- szerepkörök;
- gazdaságonkénti adatbázis-jogosultság;
- szerveroldali ellenőrzés;
- fájlhozzáférési szabályok;
- exportjogosultság;
- biztonsági napló;
- auditnapló;
- adminriasztás.

Minél több egymástól független védelmi réteg van, annál kisebb az esélye annak, hogy egyetlen hiba teljes adatlopáshoz vezessen.

## 11. Különösen védjük a tömeges adatkiadást

Egy backup vagy nagy export veszélyesebb lehet, mint egyetlen adatlap megnyitása, mert egyszerre sok adat kerülhet ki.

Ezért az ilyen funkciókat különösen szigorúan kell jogosítani és naplózni. Ha valaki szokatlan módon vagy túl sokszor próbál exportot indítani, azt a biztonsági rendszer gyanús eseményként kezelheti.

## 12. Mennyi ideig őrizzük a biztonsági naplót?

A normál biztonsági eseményeket alapértelmezés szerint korlátozott ideig, jelenlegi terv szerint körülbelül 90 napig őrizzük.

Ha valódi biztonsági incidens történik, a kapcsolódó eseményeket szükség esetén hosszabb ideig meg lehet őrizni az incidens kivizsgálása és az esetleges jogi eljárás miatt.

## 13. Amit szándékosan nem ígérünk

Nem állítjuk azt, hogy az Agrár Mentor feltörhetetlen.

Amit vállalni lehet, az az, hogy:
- nem egyetlen védelmi mechanizmusra támaszkodunk;
- a jogosultságokat adatbázisszinten is ellenőrizzük;
- a kritikus műveleteket szerveroldalon ellenőrizzük;
- a titkos kulcsokat elválasztjuk a publikus alkalmazástól;
- a gyanús eseményeket naplózzuk és értékeljük;
- az új funkciókat biztonsági szempontból is felülvizsgáljuk;
- a talált hibákat nemcsak dokumentáljuk, hanem javítjuk is.

## 14. Röviden: hogyan próbáljuk megvédeni az ügyféladatokat?

Úgy, mintha nem egyetlen zár lenne az ajtón, hanem több egymás mögötti ajtó.

Ha valaki megszerez egy jelszót, attól még nem kellene hozzáférnie minden gazdasághoz. Ha valaki megkerüli a weboldal egyik ellenőrzését, az adatbázisnak még mindig meg kell állítania. Ha valaki gyanúsan próbálkozik, annak nyoma marad. Ha sok ilyen próbálkozás történik, az admin értesítést kaphat.

A cél egy olyan rendszer, amely a normál felhasználónak egyszerűen működik, a háttérben viszont folyamatosan több biztonsági réteg védi az adatokat.
