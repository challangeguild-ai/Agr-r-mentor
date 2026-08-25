"use client";

import {useEffect,useMemo,useState} from "react";
import styles from "./GuidedTour.module.css";

export type HelpContent={
  title:string;
  body:string;
  important?:string;
  example?:string;
  steps?:string[];
};
type Step=HelpContent&{selector:string;helpId:string};
export type TourRole="advisor"|"farmer";

const tours:Record<TourRole,{version:number;name:string;intro:string;steps:Step[]}>= {
  advisor:{version:2,name:"Szaktanácsadói virtuális séta",intro:"Végigvezetünk a legfontosabb szaktanácsadói funkciókon. A séta bármikor újraindítható a menüből.",steps:[
    {helpId:"advisor-home",selector:'[data-tour="advisor-home"]',title:"Kezdőlap",body:"Innen látod a napi állapotot és innen indíthatod a leggyakoribb munkafolyamatokat.",example:"Például reggel innen ellenőrizheted, melyik ügyfélnél van esedékes szemle vagy sürgős teendő."},
    {helpId:"advisor-clients",selector:'[data-tour="advisor-clients"]',title:"Ügyfelek és gazdaságok",body:"Itt kezeled a gazdálkodókat, gazdaságaikat és a hozzájuk tartozó földterületeket.",example:"Példa: létrehozod a „Kovács Péter gazdasága” gazdaságot, majd ehhez kapcsolod a nagykátai 12,4 ha-os kukoricatáblát.",steps:["Nyisd meg az Ügyfelek menüpontot.","Válaszd ki a gazdálkodót vagy hozz létre újat.","Add hozzá a gazdaságot.","Ezután rögzítsd a hozzá tartozó táblákat és adatokat."]},
    {helpId:"advisor-workday",selector:'[data-tour="advisor-workday"]',title:"Munkanap",body:"A napi szaktanácsadói tevékenységek gyors indítófelülete: szemlék, feladatok és következő teendők.",example:"Példa: a helyszíni szemle után azonnal rögzítheted a gyomosodást, képet csatolhatsz, majd javaslatot adhatsz gyomirtási műveletre."},
    {helpId:"advisor-operations",selector:'[data-tour="advisor-operations"]',title:"Agrár műveletek",body:"Itt követheted és készítheted elő a műveleteket. A szaktanácsadó szakmai javaslatot ad, a gazdasági jóváhagyást nem ő végzi.",important:"Engedélyköteles kijuttatásnál a szükséges jogosultság és jóváhagyás a gazdaság kijelölt jogosult személyének feladata.",example:"Példa: kukorica gyomirtásnál kiválasztod a táblát és a készítményt, megadod a javasolt dózist és határidőt. A gazdaság ezután saját jogosult személyével hagyja jóvá a végrehajtást.",steps:["Válaszd ki a gazdaságot és a táblát.","Add meg a művelet típusát és tervezett dátumát.","Növényvédelmi műveletnél válaszd ki a hivatalos katalógusból a készítményt.","Válaszd a hivatalos dózist vagy adj meg annál nem nagyobb egyéni dózist.","Mentsd szakmai javaslatként; a gazdasági jóváhagyás külön folyamat."]},
    {helpId:"advisor-plant",selector:'[data-tour="advisor-plant"]',title:"Növényvédelem",body:"Országfüggő növényvédőszer-katalógusok, hivatalos források, dózisok és szabályozási státuszok kezelése.",important:"Visszavont készítmény továbbra is kereshető történeti célból, de a rendszer a művelet dátumához tartozó jogszerű alkalmazhatóságot vizsgálja.",example:"Példa: egy 2025-ben még türelmi idő alatt alkalmazható szer régi műveletben továbbra is látható, miközben új, határidő utáni kijuttatásként már nem menthető."},
    {helpId:"advisor-map",selector:'[data-tour="advisor-map"]',title:"Térkép",body:"A gazdaságok és táblák térképes áttekintése. Innen gyorsan elérhetők a területi adatok.",example:"Példa: szemle előtt térképen megnyitod az ügyfél gazdaságát, kiválasztod a táblát, és ellenőrzöd a terület pontos elhelyezkedését."},
  ]},
  farmer:{version:2,name:"Gazdálkodói virtuális séta",intro:"Röviden megmutatjuk, hol találod a földeket, műveleteket, jóváhagyásokat és a napi teendőket.",steps:[
    {helpId:"farmer-dashboard",selector:'[data-tour="farmer-dashboard"]',title:"Áttekintés",body:"A gazdaságod fő összefoglalója: aktuális teendők, határidők és legfontosabb események.",example:"Példa: belépés után azonnal látod, hogy holnapra esedékes egy kezelés és van egy új szaktanácsadói javaslatod."},
    {helpId:"farmer-fields",selector:'[data-tour="farmer-fields"]',title:"Táblák",body:"Itt találod a földterületeidet, azok adatait, kultúráit és kapcsolódó előzményeit.",example:"Példa: a „Déli 12” táblánál láthatod az aktuális kukoricakultúrát, a területet és az összes korábbi szemlét és műveletet."},
    {helpId:"farmer-operations",selector:'[data-tour="farmer-operations"]',title:"Műveleti napló",body:"A tervezett és elvégzett agrár műveletek teljes nyilvántartása, országfüggő növényvédelmi szabályokkal.",important:"A rendszer figyelmeztet vagy blokkol, ha egy növényvédő szer az adott műveleti dátumon nem alkalmazható.",example:"Példa: permetezés rögzítésekor kiválasztod a táblát, a szert, majd a hivatalos vagy annál nem nagyobb egyéni dózist.",steps:["Válaszd ki a táblát.","Add meg a művelet típusát és dátumát.","Válaszd ki a készítményt és dózist.","Ellenőrizd a rendszer figyelmeztetéseit.","Mentsd vagy küldd jóváhagyásra, ha szükséges."]},
    {helpId:"farmer-approvals",selector:'[data-tour="farmer-approvals"]',title:"Jóváhagyások",body:"A jogosultsághoz kötött műveleteket itt hagyhatja jóvá a gazdaság kijelölt jogosult személye.",important:"A jóváhagyó személynek a szükséges érvényes jogosultsággal kell rendelkeznie.",example:"Példa: a szaktanácsadó javasol egy engedélyköteles kezelést; a gazdaság kijelölt jogosult személye ellenőrzi és jóváhagyja azt a végrehajtás előtt."},
    {helpId:"farmer-tasks",selector:'[data-tour="farmer-tasks"]',title:"Teendők",body:"Határidős munkák, szaktanácsadói javaslatokból létrejött feladatok és saját teendők egy helyen.",example:"Példa: a szemle után létrejön egy „Gyomirtás elvégzése augusztus 30-ig” teendő, amelyet teljesítés után lezárhatsz."},
    {helpId:"farmer-messages",selector:'[data-tour="farmer-messages"]',title:"Üzenetek",body:"Kapcsolattartás a szaktanácsadóval. Kérdés vagy bizonytalan helyzet esetén innen tudsz gyorsan egyeztetni.",example:"Példa: kezelés előtt fényképet küldesz a problémáról, és pontosítást kérsz a szaktanácsadótól."},
  ]}
};

function HelpDetails({content}:{content:HelpContent}){
  const [exampleOpen,setExampleOpen]=useState(false);
  const [stepsOpen,setStepsOpen]=useState(false);
  return <>
    <p>{content.body}</p>
    {content.important&&<div className={styles.important}><strong>Fontos tudnivaló</strong><span>{content.important}</span></div>}
    {content.example&&<div className={styles.extra}><button type="button" className={styles.extraButton} onClick={()=>setExampleOpen(v=>!v)}>{exampleOpen?"Példa elrejtése":"Mutass egy gyakorlati példát"}</button>{exampleOpen&&<div className={styles.example}><strong>Gyakorlati példa</strong><span>{content.example}</span></div>}</div>}
    {content.steps?.length&&<div className={styles.extra}><button type="button" className={styles.extraButton} onClick={()=>setStepsOpen(v=>!v)}>{stepsOpen?"Lépések elrejtése":"Mutasd lépésről lépésre"}</button>{stepsOpen&&<ol className={styles.stepList}>{content.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>}</div>}
  </>;
}

export function GuidedTour({role}:{role:TourRole}){
  const cfg=tours[role];
  const storageKey=`agrar-mentor-tour:${role}:v${cfg.version}`;
  const [welcome,setWelcome]=useState(false);
  const [index,setIndex]=useState<number|null>(null);
  const [rect,setRect]=useState<DOMRect|null>(null);
  const steps=useMemo(()=>cfg.steps.filter(s=>typeof document==="undefined"||document.querySelector(s.selector)),[cfg.steps,index]);

  useEffect(()=>{try{if(!localStorage.getItem(storageKey))setWelcome(true)}catch{}},[storageKey]);
  useEffect(()=>{
    if(index===null)return;
    const step=steps[index]; if(!step){finish();return}
    const update=()=>{const el=document.querySelector(step.selector) as HTMLElement|null;if(!el){next();return}el.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>setRect(el.getBoundingClientRect()),180)};
    update(); window.addEventListener("resize",update); window.addEventListener("scroll",update,true);
    return()=>{window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true)};
  },[index,steps]);
  useEffect(()=>{const handler=()=>start();window.addEventListener(`agrar-tour-${role}`,handler);return()=>window.removeEventListener(`agrar-tour-${role}`,handler)},[role]);

  function mark(){try{localStorage.setItem(storageKey,new Date().toISOString())}catch{}}
  function start(){setWelcome(false);setIndex(0)}
  function finish(){mark();setIndex(null);setRect(null)}
  function skip(){finish()}
  function next(){if(index===null)return;if(index>=steps.length-1)finish();else setIndex(index+1)}
  function prev(){if(index!==null&&index>0)setIndex(index-1)}

  const step=index===null?null:steps[index];
  let cardStyle:React.CSSProperties={};
  if(rect){const roomRight=window.innerWidth-rect.right;cardStyle=roomRight>390?{left:Math.min(window.innerWidth-376,rect.right+18),top:Math.max(16,Math.min(window.innerHeight-520,rect.top))}:{left:Math.max(16,Math.min(window.innerWidth-376,rect.left)),top:Math.max(16,Math.min(window.innerHeight-520,rect.bottom+16))}}

  return <>
    {welcome&&<div className={styles.welcome}><div className={styles.welcomeCard}><span className={styles.eyebrow}>Segítség az első lépésekhez</span><h2>{cfg.name}</h2><p>{cfg.intro}</p><div className={styles.welcomeActions}><button className={styles.button} onClick={start}>Induljon a séta</button><button className={styles.ghost} onClick={()=>{mark();setWelcome(false)}}>Most kihagyom</button></div></div></div>}
    {step&&rect&&<><div className={styles.spotlight} style={{left:rect.left-7,top:rect.top-7,width:rect.width+14,height:rect.height+14}}/><div className={styles.card} style={cardStyle}><button className={styles.close} aria-label="Séta bezárása" onClick={skip}>×</button><span className={styles.eyebrow}>{index!+1}. lépés / {steps.length}</span><h3>{step.title}</h3><HelpDetails key={`${role}-${index}`} content={step}/><div className={styles.progress}><span style={{width:`${((index!+1)/steps.length)*100}%`}}/></div><div className={styles.actions}><button className={styles.ghost} onClick={skip}>Kilépés</button><div className={styles.group}>{index!>0&&<button className={styles.ghost} onClick={prev}>Vissza</button>}<button className={styles.button} onClick={next}>{index===steps.length-1?"Befejezés":"Tovább"}</button></div></div></div></>}
  </>;
}

export function TourRestartButton({role}:{role:TourRole}){return <button type="button" className={styles.restart} onClick={()=>window.dispatchEvent(new Event(`agrar-tour-${role}`))}>Virtuális séta indítása</button>}

export function BlockHelpButton({content,label="Blokk magyarázata"}:{content:HelpContent;label?:string}){
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" className={styles.infoButton} aria-label={label} title={label} onClick={()=>setOpen(true)}>i</button>
    {open&&<div className={styles.helpOverlay} onMouseDown={()=>setOpen(false)}><div className={styles.helpCard} role="dialog" aria-modal="true" aria-label={content.title} onMouseDown={e=>e.stopPropagation()}><button className={styles.close} aria-label="Súgó bezárása" onClick={()=>setOpen(false)}>×</button><span className={styles.eyebrow}>Gyors segítség</span><h3>{content.title}</h3><HelpDetails content={content}/><div className={styles.helpFooter}><button className={styles.button} onClick={()=>setOpen(false)}>Értem</button></div></div></div>}
  </>;
}

export function TourBlockHelp({role,helpId,label}:{role:TourRole;helpId:string;label?:string}){
  const content=tours[role].steps.find(s=>s.helpId===helpId);
  if(!content)return null;
  return <BlockHelpButton content={content} label={label}/>;
}
