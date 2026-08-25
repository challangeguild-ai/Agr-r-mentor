# Agrár Műveleti Modul – HU/SK katalógusvezérelt rendszer

A műveleti napló elsődleges adatforrása a `field_operations` tábla; az idővonal kapcsolt eseménynapló. A gazda és a szaktanácsadó nézet, a szűrések és a CSV export a strukturált műveleti táblából dolgoznak.

A földtábla országát a szerver a gazdaság `country_code` értékéből határozza meg. Talajmunka, vetés, betakarítás, öntözés, kaszálás és egyéb munkák az `operation_catalog` katalógusból választhatók. A műtrágya metaadataiból számított N/P2O5/K2O kijuttatás megjelenik, és a metaadat a rekordban is megmarad. A gazdaság aktív gépei közvetlenül választhatók, a szerver a gép gazdasághoz tartozását ellenőrzi.

Hivatalos növényvédelmi adatoknál a folyamat: `ország → kultúra → engedélyezett készítmény → engedélyezett felhasználás/cél → dózis`. A szerver mentéskor újra ellenőrzi az országot, aktív állapotot, engedély-időszakot, kötelező felhasználást, termék–felhasználás kapcsolatot, dózisegységet és dózistartományt; a kultúra, cél és hatóanyag törzsadatból származik.

A HU forrás a Nébih növényvédőszer-adatbázis, az SK forrás az ÚKSÚP ISPOR/ORP. A forrásállapotot az `operation_catalog_sources` tábla kezeli. A tényleges hivatalos tartalomimport külső adat-hozzáférés függvénye; amíg az import nem `ready`, az alkalmazás ezt jelzi, kézi rögzítést enged, és a rekordot nem minősíti hivatalos katalógusosnak.

A `field_operations` RLS aktív. Törléskor adatbázis-trigger takarítja a kapcsolt idővonal-eseményt. A régi OPJSON és a 6 korábbi szöveges demo művelet migrációval a strukturált naplóba került. Az integrációs törlési próba tranzakcióban sikeres volt. A modul kódját tartalmazó commit Vercel buildje sikeres; a végső ági dokumentációs commitok buildje külön fut.
