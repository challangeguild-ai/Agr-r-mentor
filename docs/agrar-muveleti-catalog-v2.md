# Agrár Műveleti Modul – HU/SK katalógusvezérelt rendszer

## Adatmodell

A műveleti napló elsődleges adatforrása a `field_operations` tábla. Az idővonal minden új művelethez kapcsolt `field_operation` eseményt kap, de a műveleti képernyők, szűrések és CSV export a strukturált táblából dolgoznak.

A strukturált rekord tartalmazza többek között az országot, művelettípust, munkafolyamatot, készítményt/anyagot, engedélyszámot, kultúrát, célkárosítót, hatóanyagot, dózist, mennyiséget, kezelt területet, gépet, végrehajtót, körülményeket és adatforrás-módot.

## Országfüggő működés

- A földtábla országát a szerver a gazdaság `country_code` értékéből határozza meg. Kliensoldali országérték nem engedélyezési forrás.
- Az `/api/operation-catalog` hitelesített végpont HU/SK ország és művelettípus szerint szolgálja ki a katalógust.
- Talajmunka, vetés, betakarítás, öntözés, kaszálás és egyéb munkák munkafolyamatai az `operation_catalog` táblából érkeznek.
- A műtrágya-katalógus metaadataiból az űrlap kiszámítja a hektáronként kijuttatott N/P2O5/K2O hatóanyagot; a katalógusmetaadat a műveleti rekordban is megmarad.
- A gazdaság aktív gépei közvetlenül választhatók, a szerver ellenőrzi a gép gazdasághoz tartozását.

## Növényvédelem

Hivatalos katalógusadat esetén a folyamat:

`ország → kultúra → engedélyezett készítmény → engedélyezett felhasználás/cél → dózis`

Mentéskor a szerver újra ellenőrzi:

- a készítmény országát és aktív állapotát,
- az engedély érvényességét a művelet dátumán,
- a kiválasztott felhasználás termékhez tartozását,
- a kultúrát/célt a felhasználási rekordból,
- a dózisegységet és az engedélyezett dózistartományt,
- a hatóanyagokat a terméktörzsből.

A HU forrás a Nébih növényvédőszer-adatbázis, az SK forrás az ÚKSÚP ISPOR/ORP. A források állapotát az `operation_catalog_sources` tábla kezeli. Amíg a hivatalos forrásadat importja nem `ready`, az alkalmazás egyértelműen jelzi ezt és kézi rögzítést enged, de azt nem jelöli hivatalos katalógusos adatnak.

## Jogosultság és konzisztencia

A `field_operations` RLS szabályai a szaktanácsadói hozzáférést és a gazdaság tulajdonosának saját műveleteit különítik el. A művelet törlése adatbázis-triggerrel automatikusan eltávolítja a hozzá kapcsolt idővonal-eseményt. A korábbi OPJSON és demo műveleti eseményekhez migrációk biztosítják a strukturált naplóval való kompatibilitást.

## Export

A gazda és a szaktanácsadó CSV exportja a strukturált naplóból készül, és az alapadatokon túl az országot, munkafolyamatot, engedélyszámot, kultúrát, célkárosítót, hatóanyagot és az adatforrás módját is tartalmazza.
