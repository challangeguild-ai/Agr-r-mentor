# Agrár Műveleti Modul 2.0 – megfelelőségi réteg

## Cél
A meglévő HU/SK műveleti napló fölé egységes, auditálható döntéstámogató réteg kerül. A szerveroldali mentési validáció marad az elsődleges biztonsági kapu; a megfelelőségi réteg ugyanazokat a szakmai kockázatokat egységes státuszokká alakítja.

## Státuszok
- `ok`: a rendelkezésre álló adatok alapján megfelel.
- `warning`: végrehajtás előtt emberi ellenőrzés vagy gazdasági jóváhagyás szükséges.
- `blocked`: a művelet a megadott adatokkal nem tekinthető végrehajthatónak.

## Ellenőrzési pontok
1. készítmény aktív státusza;
2. engedély időbeli hatálya és türelmi idő;
3. hatósági státusz;
4. hivatalos kultúra/felhasználás;
5. hivatalos dózistartomány;
6. gazdasági jóváhagyás;
7. hivatalos adatforrás frissessége.

## Felelősségi határ
A rendszer döntéstámogató eszköz. Nem helyettesíti a művelet napján hatályos NÉBIH/ÚKSÚP engedélyokiratot, a jogszabályt vagy a gazdaság jogosult személyének döntését. A szaktanácsadói javaslat nem válik automatikusan gazdasági kijuttatási jóváhagyássá.

## Következő integráció
A `OperationCompliancePanel` a műveleti adatlapokon és a rögzítési folyamat előnézetében használható. Az `operationExecutionReadiness` a teendő/végrehajtási életciklushoz ad egységes kaput. A hatósági import adapter csak dokumentált, ellenőrizhető forrást használhat; nem szabad nem létező API-t feltételezni.
