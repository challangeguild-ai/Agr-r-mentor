# Napi munkavégzés 2.0

A csomag célja, hogy az Agrár Mentor a napi szakmai és végrehajtási munkát aktívan szervezze.

## Fő folyamat

Szemle → teendő → kiosztás → végrehajtás → bizonyíték → ellenőrzés → visszaigazolás → automatikus utánkövetés.

## Prioritási logika

A prioritási motor pontozza a lejárt, ma esedékes, kritikus, magas prioritású, olvasatlan, jóváhagyásra váró és visszaellenőrzésre váró tételeket. A pontszám alapján Azonnali / Magas / Normál / Alacsony szintet rendel.

## Biztonsági korlátok

A motor csak sorrendez és figyelmeztet. Nem hagy jóvá növényvédelmi műveletet, nem változtat jogosultságot, nem zár le feladatot automatikusan és nem indít adatvesztéssel járó műveletet.

## Végrehajtási bizonyíték

A végrehajtás visszaigazolásához a közös validátor tényleges időpontot, megjegyzést és legalább egy fényképet vár. Gépet, végrehajtót és felhasznált anyagot az adott művelet szabályai szerint lehet hozzákapcsolni.

## Utánkövetés

A közös szabálymotor visszaellenőrzési javaslatot készít a forrás típusa és szakmai állapota alapján. Kritikus szemlénél rövidebb, normál szemlénél hosszabb utánkövetés javasolt. A szabálymotor önmagában nem ír adatbázisba; a tényleges feladat létrehozását a jogosultsággal védett szerveroldali munkafolyamat végzi majd.
