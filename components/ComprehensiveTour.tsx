"use client";
import {useEffect,useMemo,useState} from "react";
import {usePathname,useRouter} from "next/navigation";

type Role="farmer"|"advisor"|"system-admin";
type Step={id:string;title:string;body:string;selector:string;href?:string;optional?:boolean;important?:string};
const menu=(id:string,title:string,body:string,selector:string):Step=>({id,title,body,selector});
const page=(id:string,title:string,body:string,href:string,selector:string,important?:string):Step=>({id,title,body,href,selector,optional:true,important});

const farmer:Step[]=[
 menu("fd-m","Áttekintés – menüpont","Innen indul a gazdaság napi áttekintése.",'[data-tour="farmer-dashboard"]'),
 page("fd-h","Áttekintés – fejléc","A fejléc mutatja, melyik gazdálkodói munkatérben vagy, és innen éred el a gyors segítséget és értesítéseket.","/dashboard","main.dashboard > header"),
 page("fd-a","Fontos figyelmeztetések","A sürgős, lejárt vagy szakmai figyelmet igénylő tételek itt kerülnek előre.","/dashboard",'[data-help-block="dashboard-alerts"]'),
 page("fd-s","Gazdasági összesítők","Terület, nyitott feladatok, figyelmet igénylő táblák és következő határidők gyors állapotképe.","/dashboard","main.dashboard > section.stats-grid, main.dashboard > section.stats, main.dashboard > section:nth-of-type(1)"),
 page("fd-w","Napi munkaterület","A táblák, teendők, dokumentumok és idővonal napi munkához szükséges összefoglalója.","/dashboard","main.dashboard > section:last-of-type"),

 menu("ff-m","Táblák – menüpont","Itt találod a földterületek nyilvántartását és szakmai állapotát.",'[data-tour="farmer-fields"]'),
 page("ff-h","Táblák – oldalfejléc","Az oldal célja az összes földtábla áttekintése kultúrával, területtel és szakmai státusszal.","/fields","main.dashboard > header"),
 page("ff-s","Táblák – összesítők","Az összes, aktív és figyelmet igénylő táblák, valamint az összterület gyors áttekintése.","/fields","main.dashboard > section.stats-grid, main.dashboard > section:nth-of-type(1)"),
 page("ff-f","Táblák – szűrés","A szűrőkkel aktív, figyelmet igénylő, feladat nélküli vagy archivált táblákra szűkíthetsz.","/fields",".task-filter-tabs"),
 page("ff-l","Táblajegyzék","A kártyák mutatják a gazdaságot, területet, kultúrát, szemleállapotot és nyitott teendőket.","/fields",'[data-help-block="fields-register"]'),

 menu("fo-m","Műveleti napló – menüpont","A gazdaság elvégzett és tervezett agrár műveleteinek naplója.",'[data-tour="farmer-operations"]'),
 page("fo-h","Műveletek – fejléc","Innen éred el a műveleti naplót, a jóváhagyásokat és az exportot.","/operations","main.dashboard > header, main.dashboard > .field-detail-header"),
 page("fo-s","Műveletek – összesítők","Az idei műveletek, növényvédelmi bejegyzések, jóváhagyások és érintett táblák állapota.","/operations","main.dashboard > section:nth-of-type(1)"),
 page("fo-n","Új művelet rögzítése","Itt rögzítheted a tényleges gazdálkodási műveletet a megfelelő táblához és géphez.","/operations","main.dashboard > section:nth-of-type(2)","Növényvédelemnél mindig ellenőrizd a hivatalos korlátokat és a szükséges gazdasági jogosultságot."),
 page("fo-j","Műveleti előzmény","A napló a korábbi műveleteket dátummal, anyaggal, dózissal, géppel, végrehajtóval és jóváhagyási státusszal mutatja.","/operations","main.dashboard > section:last-of-type"),

 menu("fa-m","Jóváhagyások – menüpont","A jogosultsághoz kötött növényvédelmi műveletek gazdasági jóváhagyása itt történik.",'[data-tour="farmer-approvals"]'),
 page("fa-h","Jóváhagyások – fejléc","Csak a hozzád rendelt, jogosultsághoz kötött műveletek jelennek meg ezen az oldalon.","/operations/approvals","main.dashboard > header"),
 page("fa-s","Jóváhagyások – státuszok","Külön látod a függő és a már jóváhagyott tételek számát.","/operations/approvals","main.dashboard > section.stats-grid, main.dashboard > section:nth-of-type(1)"),
 page("fa-p","Függő jóváhagyások","Jóváhagyás előtt ellenőrizd a készítményt, kultúrát, célt, dózist, hivatalos maximumot és saját jogosultságodat.","/operations/approvals",'[data-help-block="plant-approval"]',"A jóváhagyás nem automatikus adminisztratív kattintás, hanem felelősséggel járó gazdasági művelet."),
 page("fa-e","Jóváhagyási előzmény","Itt követhetők vissza a korábban jóváhagyott műveletek.","/operations/approvals","main.dashboard > section:last-of-type"),

 menu("ft-m","Teendők – menüpont","A határidős munkák, szaktanácsadói javaslatok és végrehajtási feladatok központja.",'[data-tour="farmer-tasks"]'),
 page("ft-h","Teendők – fejléc","Az oldal a terv → végrehajtás → ellenőrzés teljes folyamatát fogja össze.","/tasks","main.dashboard > header"),
 page("ft-s","Teendők – állapotösszesítő","Aktív, ellenőrzésre váró, lejárt és visszaigazolt munkák gyors áttekintése.","/tasks","main.dashboard > section.stats-grid, main.dashboard > section:nth-of-type(1)"),
 page("ft-f","Teendők – szűrők","A feladatlista státusz és határidő szerint szűrhető.","/tasks","main.dashboard .task-filter-tabs, main.dashboard [class*=tabs]"),
 page("ft-l","Feladatlista","A feladatkártyákon látod a szakmai tervet, tényleges végrehajtást, bizonyítékokat és ellenőrzési státuszt.","/tasks","main.dashboard > section:last-of-type"),

 menu("fm-m","Üzenetek – menüpont","Gazdálkodói jelzések és szaktanácsadói válaszok kezelése.",'[data-tour="farmer-messages"]'),
 page("fm-h","Üzenetek – fejléc","Innen indíthatsz jelzést és követheted a szakmai kommunikációt.","/messages","main.dashboard > header"),
 page("fm-n","Új üzenet vagy jelzés","A bejelentést a megfelelő gazdasághoz vagy táblához kapcsolva rögzítsd.","/messages","main.dashboard > section:nth-of-type(1)"),
 page("fm-l","Kommunikációs előzmény","Itt követhetők a válaszok, megtekintési állapotok és privát emlékeztetők.","/messages","main.dashboard > section:last-of-type"),

 menu("fdoc-m","Dokumentumok – menüpont","A gazdaság dokumentumainak központi tárhelye.",'[data-tour="farmer-documents"]'),
 page("fdoc-h","Dokumentumok – fejléc","Az oldal a gazdasághoz és táblákhoz kapcsolódó fájlokat fogja össze.","/documents","main.dashboard > header"),
 page("fdoc-u","Dokumentum feltöltése","Itt adhatsz új dokumentumot a megfelelő gazdasághoz vagy táblához.","/documents","main.dashboard > section:nth-of-type(1)"),
 page("fdoc-l","Dokumentumtár","A feltöltött dokumentumok listája és elérési pontja.","/documents","main.dashboard > section:last-of-type"),

 menu("ffarm-m","Gazdaságom – menüpont","A gazdaság alapadatai, jogosultságai és kapcsolatai.",'[data-tour="farmer-farms"]'),
 page("ffarm-h","Gazdaságom – fejléc","A saját gazdasági szervezet és alapadatok áttekintése.","/farms","main.dashboard > header"),
 page("ffarm-s","Gazdaságok és alapadatok","A nyilvántartott gazdaságok, címek, ország és kapcsolódó adatok.","/farms","main.dashboard > section:nth-of-type(1)"),
 page("ffarm-p","Növényvédelmi jogosultságok","A gazdasági növényvédelmi jóváhagyók és jogosultsági szintek kezelése.","/farms","main.dashboard > section:nth-of-type(2)"),
 page("ffarm-c","Kapcsolattartás","A gazdaság kapcsolattartási adatai és elsődleges elérhetőségei.","/farms","main.dashboard > section:last-of-type"),

 menu("fmap-m","Térkép – menüpont","A földtáblák és területek térképes áttekintése.",'[data-tour="farmer-map"]'),
 page("fmap-h","Térkép – fejléc","A térképes nézet gyors területi tájékozódást ad.","/map","main.dashboard > header"),
 page("fmap-map","Térképi munkaterület","A térképen az elérhető táblák, határok és kapcsolódó területi információk jelennek meg.","/map","main.dashboard > section:nth-of-type(1), main.dashboard [class*=map]"),
 page("fmap-list","Térképi lista és részletek","A térkép mellett a kiválasztott táblákhoz tartozó részletes adatok és navigáció érhető el.","/map","main.dashboard > section:last-of-type"),

 menu("fteam-m","Munkatársak – menüpont","A gazdaság tagjai és hozzáférései.",'[data-tour="farmer-team"]'),
 page("fteam-h","Munkatársak – fejléc","A gazdaságban dolgozó személyek és szerepköreik áttekintése.","/team","main.dashboard > header"),
 page("fteam-i","Munkatárs meghívása","Itt adhatsz hozzá új munkatársat a megfelelő jogosultsággal.","/team","main.dashboard > section:nth-of-type(1)"),
 page("fteam-l","Munkatárslista","A meglévő tagok, szerepkörök és hozzáférések ellenőrzése.","/team","main.dashboard > section:last-of-type"),

 menu("fdis-m","Munkakiosztás – menüpont","Feladatok kiosztása a gazdaság munkatársainak.",'[data-tour="farmer-dispatch"]'),
 page("fdis-h","Munkakiosztás – fejléc","A napi végrehajtandó munkák személyhez és géphez rendelésének felülete.","/dispatch","main.dashboard > header"),
 page("fdis-n","Új munkakiosztás","A feladatot a megfelelő munkatárshoz, táblához és szükség esetén géphez rendeld.","/dispatch","main.dashboard > section:nth-of-type(1)"),
 page("fdis-l","Kiosztott munkák","Itt követhetők a már kiosztott feladatok és végrehajtási állapotok.","/dispatch","main.dashboard > section:last-of-type"),

 menu("fmach-m","Géppark – menüpont","A gazdaság gépeinek nyilvántartása.",'[data-tour="farmer-machines"]'),
 page("fmach-h","Géppark – fejléc","Az aktív és nyilvántartott mezőgazdasági gépek központja.","/machines","main.dashboard > header"),
 page("fmach-n","Gép felvétele","Új gép típus, gyártó, modell és gazdasági kapcsolat szerint rögzíthető.","/machines","main.dashboard > section:nth-of-type(1)"),
 page("fmach-l","Géplista","A gépek állapota és műveleti felhasználhatósága itt ellenőrizhető.","/machines","main.dashboard > section:last-of-type"),

 menu("ftl-m","Idővonal – menüpont","A gazdaság eseményeinek kronologikus előzménye.",'[data-tour="farmer-timeline"]'),
 page("ftl-h","Idővonal – fejléc","Az oldal a szakmai és gazdasági eseményeket időrendben mutatja.","/timeline","main.dashboard > header"),
 page("ftl-f","Idővonal – szűrés","Az eseménytípusok és időszakok szerint szűkíthető az előzmény.","/timeline","main.dashboard > section:nth-of-type(1)"),
 page("ftl-l","Események","Szemlék, teendők, műveletek, jelzések és egyéb események kronologikus listája.","/timeline","main.dashboard > section:last-of-type"),

 menu("finv-m","Számlák – menüpont","A pénzügyi és számlázási modul helye.",'[data-tour="farmer-invoices"]'),
 page("finv-h","Számlák – fejléc","A gazdasághoz tartozó számlázási információk és későbbi pénzügyi funkciók központja.","/invoices","main.dashboard > header"),
 page("finv-s","Számlázási állapot","Az aktuális számlázási és pénzügyi összesítők itt jelennek meg.","/invoices","main.dashboard > section:nth-of-type(1)"),
 page("finv-l","Számlalista","A rendelkezésre álló számlák és kapcsolódó adatok listája.","/invoices","main.dashboard > section:last-of-type"),

 menu("fnot-m","Értesítések – menüpont","A fontos rendszer- és szakmai események központja.",'[data-tour="farmer-notifications"]'),
 page("fnot-h","Értesítések – fejléc","Itt követheted az új és korábbi értesítéseket.","/notifications","main.dashboard > header"),
 page("fnot-l","Értesítési központ","Az értesítések közvetlenül a kapcsolódó feladathoz vagy szakmai tartalomhoz vezetnek.","/notifications",'[data-tour="notification-center"], main.dashboard > section:last-of-type')
];

const advisor:Step[]=[
 menu("ah-m","Kezdőlap – menüpont","Innen indul a szaktanácsadó napi munkafolyamata.",'[data-tour="advisor-home"]'),
 page("ah-h","Kezdőlap – fejléc","A fejléc az aktuális szaktanácsadói munkateret és gyors eléréseket mutatja.","/admin","main > header"),
 page("ah-q","Gyorsmodulok","Az ügyfelek, térkép, szemlék, feladatok, jelzések, látogatások, dokumentumok és prioritások gyors belépési pontjai.","/admin","main > section:nth-of-type(1)"),
 page("ah-c","Ügyfélfókusz","A rendszer kiemeli, mely ügyfeleknél van kritikus, lejárt vagy új szakmai ügy.","/admin","main > section:nth-of-type(2)"),
 page("ah-a","Kiemelt figyelmeztetések","A legsürgősebb szakmai problémák és utánkövetési ügyek jelennek meg itt.","/admin","main > section:nth-of-type(3)"),
 page("ah-w","Napi feladatok és jelzések","A következő feladatok és gazdálkodói jelzések napi munkalistája.","/admin","main > section:last-of-type"),

 menu("ac-m","Ügyfelek – menüpont","Gazdálkodók, gazdaságok, táblák és szakmai dossziék kezelése.",'[data-tour="advisor-clients"]'),
 page("ac-h","Ügyfelek – fejléc","Az ügyfél → gazdaság → tábla → szakmai előzmény munkafolyamat kiindulópontja.","/admin/clients","main > header"),
 page("ac-s","Ügyfélportfólió – összesítők","Ügyfélszám, gazdaságok, táblák és kezelt terület gyors áttekintése.","/admin/clients","main > section:nth-of-type(1)"),
 page("ac-l","Ügyféllista","A lista szakmai prioritás szerint mutatja az ügyfeleket, nyitott feladatokat, jelzéseket és szemleállapotokat.","/admin/clients","main > section:nth-of-type(2)"),
 page("ac-n","Új ügyfél, gazdaság vagy tábla","Innen hívható meg gazdálkodó, illetve hozható létre gazdaság és földtábla.","/admin/clients","main > details:last-of-type"),

 menu("aco-m","Elérhetőségek – menüpont","A gazdaságok kapcsolattartási adatainak kezelése.",'[data-tour="advisor-contacts"]'),
 page("aco-h","Elérhetőségek – fejléc","Az ügyfélkapcsolati adatok és közvetlen kommunikációs lehetőségek központja.","/admin/contacts","main > header"),
 page("aco-f","Kapcsolattartók kezelése","Több telefonszám és e-mail cím rögzíthető, elsődleges kapcsolat kijelölésével.","/admin/contacts",'[data-tour="contact-fields"], main > section:nth-of-type(1)'),
 page("aco-l","Közvetlen hívás és e-mail","A rögzített telefonszám és e-mail közvetlen kapcsolatfelvételt tesz lehetővé.","/admin/contacts",'[data-tour="contact-links"], main > section:last-of-type'),

 menu("aw-m","Munkanap – menüpont","A napi szemlék, feladatok, látogatások és elmaradások munkaközpontja.",'[data-tour="advisor-workday"]'),
 page("aw-h","Munkanap – fejléc","Gyorsan indítható szemle, feladat és látogatás.","/admin/workday","main > header"),
 page("aw-s","Napi állapotösszesítők","Kiválasztott napi események, elmaradások, nyitott jelzések és kritikus táblák.","/admin/workday","main > section:nth-of-type(1)"),
 page("aw-week","Heti munkasáv","A következő hét nap feladatai, visszaellenőrzései és látogatásai egy naptárszerű sávban.","/admin/workday","main > section:nth-of-type(2)"),
 page("aw-plan","Kiválasztott nap munkaterve","A napi látogatások, visszaellenőrzések és feladatok végrehajtási sorrendje.","/admin/workday","main > section:nth-of-type(3)"),
 page("aw-in","Beérkező ügyek és elmaradások","Gazdálkodói jelzések, lejárt tételek és dátum nélküli feladatok utánkövetése.","/admin/workday","main > section:last-of-type"),

 menu("ao-m","Műveletek – menüpont","Az ügyfélgazdaságok rögzített műveleteinek ellenőrzési nézete.",'[data-tour="advisor-operations"]'),
 page("ao-h","Műveletek – fejléc","Olvasási és ellenőrzési nézet; a gazdasági végrehajtás elkülönül a szakmai javaslattól.","/admin/operations","main > header"),
 page("ao-s","Műveleti összesítők","Idei műveletek, növényvédelem, függő gazdasági jóváhagyások és érintett ügyfelek.","/admin/operations","main > section:nth-of-type(1)"),
 page("ao-r","Szaktanácsadói felelősségi kör","A szaktanácsadó javasol és ellenőriz, de a gazdaság engedélyköteles kijuttatását nem ő hagyja jóvá.","/admin/operations",'[data-help-block="advisor-operation-journal"]',"A szakmai javaslat és a gazdasági végrehajtási felelősség maradjon külön."),
 page("ao-j","Teljes műveleti napló","Készítmény, dózis, hivatalos maximum, gép, végrehajtó és jóváhagyási státusz ellenőrzése.","/admin/operations","main > section:last-of-type"),

 menu("ap-m","Növényvédelem – menüpont","HU/SK hivatalos növényvédőszer-adatok és katalóguskezelés.",'[data-tour="advisor-plant"]'),
 page("ap-h","Növényvédelem – fejléc","A hivatalos növényvédőszer-adatok szinkronizálási és ellenőrzési központja.","/admin/plant-protection-import","main > header"),
 page("ap-s","Katalógusállapot","Az elérhető magyar és szlovák források, szinkronizálási és adatminőségi állapotok.","/admin/plant-protection-import","main > section:nth-of-type(1)"),
 page("ap-i","Import és frissítés","A hivatalos katalógusok frissítési és importfolyamatai innen indíthatók.","/admin/plant-protection-import","main > section:nth-of-type(2), main form"),
 page("ap-r","Ellenőrzési eredmények","A betöltött adatok, hibák és feldolgozási eredmények ellenőrzése.","/admin/plant-protection-import","main > section:last-of-type"),

 menu("am-m","Térkép – menüpont","Ügyfelek, gazdaságok és földtáblák térképes szakmai áttekintése.",'[data-tour="advisor-map"]'),
 page("am-h","Térkép – fejléc","Területi navigáció és ügyfélgazdaságok gyors elérése.","/admin/map","main > header"),
 page("am-map","Térképi munkaterület","A táblák elhelyezkedése, területi kapcsolatok és kiválasztott objektumok jelennek meg itt.","/admin/map","main > section:nth-of-type(1), main [class*=map]"),
 page("am-l","Térképi lista","A térképhez kapcsolódó gazdaság- és táblalista a gyors navigációhoz.","/admin/map","main > section:last-of-type"),

 menu("ad-m","Dokumentumok – menüpont","Az ügyfelekhez és szakmai munkához kapcsolódó dokumentumok.",'[data-tour="advisor-documents"]'),
 page("ad-h","Dokumentumok – fejléc","Az ügyféldokumentumok központi szakmai tárhelye.","/admin/documents","main > header"),
 page("ad-f","Dokumentumszűrés és kontextus","A dokumentumok ügyfél, gazdaság vagy tábla szerint rendezhetők és kapcsolhatók.","/admin/documents","main > section:nth-of-type(1)"),
 page("ad-l","Dokumentumtár","A már feltöltött szakmai dokumentumok listája és elérési pontja.","/admin/documents","main > section:last-of-type")
];

const sys:Step[]=[
 menu("sa-m","Rendszeráttekintés – menüpont","A rendszeradminisztrátori portál kezdőoldala.",'[data-admin-tour="admin-home"]'),
 page("sa-h","Rendszeráttekintés – cél és hatáskör","Rendszerfelügyelet, támogatás, incidensvizsgálat és auditált adminisztrátori beavatkozás.","/system-admin","main > header, [data-admin-tour="admin-header"]"),
 page("sa-s","Rendszerösszesítők","Felhasználók, gazdaságok és földtáblák rendszerszintű állapotképe.","/system-admin",'[data-admin-tour="admin-summary"], main > section:nth-of-type(1)'),
 page("sa-c","Adminisztrációs munkaterületek","A támogatási, felhasználói és biztonsági modulok gyors belépési pontjai.","/system-admin",'[data-admin-tour="admin-cards"], main > section:nth-of-type(2)'),
 page("sa-a","Admin auditnapló","Az érzékeny adminisztrátori beavatkozások visszakövetése.","/system-admin",'[data-admin-tour="admin-audit"], main > section:last-of-type'),

 menu("ss-m","Támogatási központ – menüpont","Felhasználói és munkafolyamat-problémák vizsgálata.",'[data-admin-tour="admin-support"]'),
 page("ss-h","Támogatás – fejléc","Az adminisztrátori támogatás célja és korlátai ezen az oldalon jelennek meg.","/system-admin/support","main > header"),
 page("ss-s","Támogatási összesítők","A problémás vagy vizsgálatra váró rendszerállapotok gyors áttekintése.","/system-admin/support","main > section:nth-of-type(1)"),
 page("ss-l","Támogatási munkalista","A vizsgálható ügyek és adminisztrátori beavatkozási pontok listája.","/system-admin/support","main > section:last-of-type","Beavatkozás csak indoklással és a szükséges auditnyom megtartásával történjen."),

 menu("su-m","Felhasználók – menüpont","Felhasználói és rendszerjogok kezelése.",'[data-admin-tour="admin-users"]'),
 page("su-h","Felhasználók – fejléc","Gazdálkodók, szaktanácsadók és rendszeradmin-jogok elkülönített kezelése.","/system-admin/users","main > header"),
 page("su-s","Felhasználói összesítők","A szerepkörök és fiókállapotok gyors áttekintése.","/system-admin/users","main > section:nth-of-type(1)"),
 page("su-l","Felhasználólista és jogosultságok","A fiókok, üzleti szerepkörök és rendszeradmin-jogosultságok ellenőrzése.","/system-admin/users","main > section:last-of-type","A rendszeradmin-jog nem azonos a szaktanácsadói üzleti szerepkörrel."),

 menu("sec-m","Biztonsági események – menüpont","Hitelesítési és jogosultsági kockázatok vizsgálata.",'[data-admin-tour="admin-security"]'),
 page("sec-h","Biztonság – fejléc","A biztonsági események és kockázatos aktivitások központja.","/system-admin/security","main > header"),
 page("sec-s","Biztonsági összesítők","A magasabb kockázatú események gyors áttekintése.","/system-admin/security","main > section:nth-of-type(1)"),
 page("sec-l","Biztonsági eseménylista","Az események időponttal, kockázattal és technikai kontextussal vizsgálhatók.","/system-admin/security","main > section:last-of-type"),

 menu("sb-m","Biztonsági mentés – menüpont","A kiemelten védett teljes adatmentés felülete.",'[data-admin-tour="admin-backup"]'),
 page("sb-h","Biztonsági mentés – fejléc","A teljes adatmentés kiemelten érzékeny rendszeradminisztrátori művelet.","/system-admin/backup","main > header"),
 page("sb-r","MFA és friss hitelesítés","Az exporthoz a meglévő bejelentkezésen felül friss authenticator-hitelesítés szükséges.","/system-admin/backup","main > section:nth-of-type(1), main form","A mentési exportot csak indokolt esetben és megfelelő adatkezelési környezetben végezd."),
 page("sb-e","Export művelet","Innen indítható a szerveroldali, auditált rendszermentés.","/system-admin/backup","main > section:last-of-type, main form")
];

const config={farmer:{version:8,name:"Gazdálkodói teljes rendszerbemutató",steps:farmer},advisor:{version:8,name:"Szaktanácsadói teljes rendszerbemutató",steps:advisor},"system-admin":{version:4,name:"Rendszeradminisztrátori teljes rendszerbemutató",steps:sys}} as const;

export function ComprehensiveTour({role}:{role:Role}){const cfg=config[role];const steps=useMemo(()=>[...cfg.steps],[cfg.steps]);const router=useRouter();const pathname=usePathname();const doneKey=`agrar-comprehensive-tour:${role}:v${cfg.version}`;const stateKey=`${doneKey}:state`;const[index,setIndex]=useState<number|null>(null);const[welcome,setWelcome]=useState(false);const[rect,setRect]=useState<DOMRect|null>(null);
 useEffect(()=>{try{const raw=sessionStorage.getItem(stateKey);if(raw!==null){const n=Number(raw);if(Number.isInteger(n)&&n>=0&&n<steps.length){setIndex(n);return}}if(!localStorage.getItem(doneKey))setWelcome(true)}catch{}},[doneKey,stateKey,steps.length]);
 useEffect(()=>{if(index===null)return;const step=steps[index];if(!step)return finish();try{sessionStorage.setItem(stateKey,String(index))}catch{}if(step.href&&pathname!==step.href){setRect(null);router.push(step.href);return}let timer=0,tries=0,el:HTMLElement|null=null;const measure=()=>{if(el)setRect(el.getBoundingClientRect())};const seek=()=>{el=document.querySelector(step.selector) as HTMLElement|null;if(el){const r=el.getBoundingClientRect();if((r.width===0||r.height===0||r.right<0||r.left>window.innerWidth)&&!step.href){const launch=document.querySelector('button[aria-label*="Menü megnyitása"],button[aria-label*="Admin menü megnyitása"]') as HTMLButtonElement|null;if(launch){launch.click();timer=window.setTimeout(seek,180);return}}el.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});measure();timer=window.setTimeout(measure,220);return}tries++;if(tries<15){timer=window.setTimeout(seek,100);return}console.warn(`[ComprehensiveTour] Missing target ${step.selector} on ${pathname}`);move(1)};seek();window.addEventListener("resize",measure);window.addEventListener("scroll",measure,true);return()=>{window.clearTimeout(timer);window.removeEventListener("resize",measure);window.removeEventListener("scroll",measure,true)}},[index,pathname,router,stateKey,steps]);
 useEffect(()=>{const ev=`agrar-comprehensive-tour-${role}`;const h=()=>start();window.addEventListener(ev,h);return()=>window.removeEventListener(ev,h)},[role]);
 function mark(){try{localStorage.setItem(doneKey,new Date().toISOString());sessionStorage.removeItem(stateKey)}catch{}}
 function start(){try{localStorage.removeItem(doneKey);sessionStorage.setItem(stateKey,"0")}catch{}setWelcome(false);setIndex(0)}
 function finish(){mark();setIndex(null);setRect(null)}
 function move(delta:number){setIndex(cur=>{if(cur===null)return null;const next=cur+delta;if(next<0)return 0;if(next>=steps.length){mark();setRect(null);return null}try{sessionStorage.setItem(stateKey,String(next))}catch{}return next})}
 const step=index===null?null:steps[index];const cardW=Math.min(410,typeof window!=="undefined"?window.innerWidth-24:410);let left=12,top=12;if(rect&&typeof window!=="undefined"){left=Math.max(12,Math.min(window.innerWidth-cardW-12,rect.left));top=rect.bottom+300<window.innerHeight?rect.bottom+12:Math.max(12,rect.top-286)}
 return <>{welcome&&<div style={{position:"fixed",inset:0,zIndex:20000,background:"rgba(9,18,13,.76)",display:"grid",placeItems:"center",padding:16}}><div style={{width:"min(520px,100%)",background:"#fff",borderRadius:18,padding:22,boxShadow:"0 24px 70px rgba(0,0,0,.35)"}}><small style={{fontWeight:900,color:"#17613d"}}>TELJES RENDSZERBEMUTATÓ</small><h2 style={{margin:"8px 0"}}>{cfg.name}</h2><p style={{lineHeight:1.55,color:"#56635b"}}>A túra menüpontonként halad: először megmutatja a menüpontot, majd megnyitja az oldalt és blokkról blokkra elmagyarázza a tényleges munkafolyamatot.</p><div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}><button className="ghost-btn" onClick={()=>{mark();setWelcome(false)}}>Most kihagyom</button><button className="btn btn-primary" onClick={start}>Induljon a teljes túra</button></div></div></div>}{step&&rect&&<><div aria-hidden="true" style={{position:"fixed",zIndex:20001,left:Math.max(6,rect.left-8),top:Math.max(6,rect.top-8),width:Math.min(window.innerWidth-12,rect.width+16),height:Math.min(window.innerHeight-12,rect.height+16),borderRadius:14,boxShadow:"0 0 0 9999px rgba(8,15,11,.76),0 0 0 3px #fff,0 0 0 6px #1c6845",pointerEvents:"none",transition:"all .2s ease"}}/><section role="dialog" aria-label={step.title} style={{position:"fixed",zIndex:20002,left,top,width:cardW,maxHeight:"min(430px,calc(100vh - 24px))",overflow:"auto",background:"#fff",border:"2px solid #1c6845",borderRadius:16,padding:18,boxShadow:"0 20px 60px rgba(0,0,0,.34)"}}><small style={{fontWeight:900,color:"#1c6845"}}>{index!+1}. LÉPÉS / {steps.length}</small><h3 style={{margin:"8px 0"}}>{step.title}</h3><p style={{lineHeight:1.55,color:"#56635b"}}>{step.body}</p>{step.important&&<div style={{padding:11,borderRadius:10,background:"#f4f7f4",border:"1px solid #d8e3da",fontSize:13}}><b>Fontos: </b>{step.important}</div>}<div style={{height:4,background:"#e6ece7",borderRadius:99,margin:"16px 0"}}><span style={{display:"block",height:"100%",width:`${((index!+1)/steps.length)*100}%`,background:"#1c6845",borderRadius:99}}/></div><div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><button className="ghost-btn" onClick={finish}>Kilépés</button><div style={{display:"flex",gap:8}}>{index!>0&&<button className="ghost-btn" onClick={()=>move(-1)}>Vissza</button>}<button className="btn btn-primary" onClick={()=>move(1)}>{index===steps.length-1?"Befejezés":"Tovább"}</button></div></div></section></>}</>}
export function ComprehensiveTourRestart({role}:{role:Role}){return <button type="button" className="ghost-btn" onClick={()=>window.dispatchEvent(new Event(`agrar-comprehensive-tour-${role}`))}>Teljes virtuális túra</button>}
