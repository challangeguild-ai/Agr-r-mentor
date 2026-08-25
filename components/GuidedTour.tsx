"use client";

import {useEffect,useMemo,useState} from "react";
import styles from "./GuidedTour.module.css";

type Step={selector:string;title:string;body:string};
export type TourRole="advisor"|"farmer";

const tours:Record<TourRole,{version:number;name:string;intro:string;steps:Step[]}>= {
  advisor:{version:1,name:"Szaktanácsadói virtuális séta",intro:"Végigvezetünk a legfontosabb szaktanácsadói funkciókon. A séta bármikor újraindítható a menüből.",steps:[
    {selector:'[data-tour="advisor-home"]',title:"Kezdőlap",body:"Innen látod a napi állapotot és innen indíthatod a leggyakoribb munkafolyamatokat."},
    {selector:'[data-tour="advisor-clients"]',title:"Ügyfelek",body:"Itt kezeled a gazdálkodókat, gazdaságaikat és a hozzájuk tartozó földterületeket."},
    {selector:'[data-tour="advisor-workday"]',title:"Munkanap",body:"A napi szaktanácsadói tevékenységek gyors indítófelülete: szemlék, feladatok és következő teendők."},
    {selector:'[data-tour="advisor-operations"]',title:"Agrár műveletek",body:"Itt követheted és készítheted elő a műveleteket. A szaktanácsadó szakmai javaslatot ad, a gazdasági jóváhagyást nem ő végzi."},
    {selector:'[data-tour="advisor-plant"]',title:"Növényvédelem",body:"Országfüggő növényvédőszer-katalógusok, hivatalos források, dózisok és szabályozási státuszok kezelése."},
    {selector:'[data-tour="advisor-map"]',title:"Térkép",body:"A gazdaságok és táblák térképes áttekintése. Innen gyorsan elérhetők a területi adatok."},
  ]},
  farmer:{version:1,name:"Gazdálkodói virtuális séta",intro:"Röviden megmutatjuk, hol találod a földeket, műveleteket, jóváhagyásokat és a napi teendőket.",steps:[
    {selector:'[data-tour="farmer-dashboard"]',title:"Áttekintés",body:"A gazdaságod fő összefoglalója: aktuális teendők, határidők és legfontosabb események."},
    {selector:'[data-tour="farmer-fields"]',title:"Táblák",body:"Itt találod a földterületeidet, azok adatait, kultúráit és kapcsolódó előzményeit."},
    {selector:'[data-tour="farmer-operations"]',title:"Műveleti napló",body:"A tervezett és elvégzett agrár műveletek teljes nyilvántartása, országfüggő növényvédelmi szabályokkal."},
    {selector:'[data-tour="farmer-approvals"]',title:"Jóváhagyások",body:"A jogosultsághoz kötött műveleteket itt hagyhatja jóvá a gazdaság kijelölt jogosult személye."},
    {selector:'[data-tour="farmer-tasks"]',title:"Teendők",body:"Határidős munkák, szaktanácsadói javaslatokból létrejött feladatok és saját teendők egy helyen."},
    {selector:'[data-tour="farmer-messages"]',title:"Üzenetek",body:"Kapcsolattartás a szaktanácsadóval. Kérdés vagy bizonytalan helyzet esetén innen tudsz gyorsan egyeztetni."},
  ]}
};

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
  if(rect){const roomRight=window.innerWidth-rect.right;cardStyle=roomRight>390?{left:Math.min(window.innerWidth-376,rect.right+18),top:Math.max(16,Math.min(window.innerHeight-300,rect.top))}:{left:Math.max(16,Math.min(window.innerWidth-376,rect.left)),top:Math.min(window.innerHeight-300,rect.bottom+16)}}

  return <>
    {welcome&&<div className={styles.welcome}><div className={styles.welcomeCard}><span className={styles.eyebrow}>Segítség az első lépésekhez</span><h2>{cfg.name}</h2><p>{cfg.intro}</p><div className={styles.welcomeActions}><button className={styles.button} onClick={start}>Induljon a séta</button><button className={styles.ghost} onClick={()=>{mark();setWelcome(false)}}>Most kihagyom</button></div></div></div>}
    {step&&rect&&<><div className={styles.spotlight} style={{left:rect.left-7,top:rect.top-7,width:rect.width+14,height:rect.height+14}}/><div className={styles.card} style={cardStyle}><button className={styles.close} aria-label="Séta bezárása" onClick={skip}>×</button><span className={styles.eyebrow}>{index!+1}. lépés / {steps.length}</span><h3>{step.title}</h3><p>{step.body}</p><div className={styles.progress}><span style={{width:`${((index!+1)/steps.length)*100}%`}}/></div><div className={styles.actions}><button className={styles.ghost} onClick={skip}>Kilépés</button><div className={styles.group}>{index!>0&&<button className={styles.ghost} onClick={prev}>Vissza</button>}<button className={styles.button} onClick={next}>{index===steps.length-1?"Befejezés":"Tovább"}</button></div></div></div></>}
  </>
}

export function TourRestartButton({role}:{role:TourRole}){return <button type="button" className={styles.restart} onClick={()=>window.dispatchEvent(new Event(`agrar-tour-${role}`))}>Virtuális séta indítása</button>}
