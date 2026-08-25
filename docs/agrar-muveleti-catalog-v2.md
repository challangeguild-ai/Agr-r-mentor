# Agrár Műveleti Modul – katalógus v2

Ez a fejlesztési lépés a HU/SK országfüggő műveleti rendszer következő rétege.

- A földtábla országát a szerver a gazdaság adatából határozza meg; kliensoldali országértéket nem tekint jogosultsági vagy engedélyezési forrásnak.
- Az `/api/operation-catalog` hitelesített végpont ország és művelettípus szerint adja vissza a műveleti katalógust.
- Növényvédelemnél a végpont visszaadja az aktív készítményeket, engedélyezett kultúra/cél/dózis felhasználásokat és hatóanyagokat.
- A műveleti űrlap országváltáskor és művelettípus-váltáskor újratölti a megfelelő katalógust.
- Katalógusból választott növényvédő szer mentésekor a szerver ellenőrzi az országot, az engedély hatályát, a termék–felhasználás kapcsolatot és az engedélyezett dózistartományt.
- A műveleti napló payloadja eltárolhatja a termékazonosítót, engedélyszámot, kultúrát, célkárosítót és felhasználás-azonosítót is.

A `plant_protection_products` katalógus jelenleg üres, ezért a hivatalos HU/SK forrásadatok betöltése külön következő adatimport-lépés.
