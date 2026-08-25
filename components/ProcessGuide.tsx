"use client";

import {useEffect,useMemo,useState} from "react";
import styles from "./ProcessGuide.module.css";

type GuideId="create-farm"|"create-operation";
type Step={selector:string;title:string;body:string;example?:string;openClosestDetails?:boolean;optional?:boolean};
type Guide={route:string;title:string;intro:string;steps:Step[]};

const guides:Record<GuideId,Guide>={
  "create-farm":{
    route:"/admin/clients",
    title:"Első gazdaság létrehozása",
    intro:"Végigmegyünk a gazdaság létrehozásának minden mezőjén. A rendszer nem ír be helyetted adatot: te töltöd ki, mi pedig minden lépésnél elmondjuk, mit és miért kell megadni.",
    steps:[
      {selector:'select[name="owner_id"]',title:"1. Gazdálkodó kiválasztása",body:"Válaszd ki azt az ügyfelet, akihez a gazdaság tartozik. Ha még nincs a listában, előbb a Gazdálkodó meghívása résznél kell létrehozni az ügyfelet.",example:"Példa: Kovács Péter",openClosestDetails:true},
      {selector:'input[name="name"]',title:"2. Gazdaság neve",body:"Adj a gazdaságnak egy jól felismerhető nevet. Ezt fogod később a táblák, műveletek és kimutatások mellett látni.",example:"Példa: Kovács Péter gazdasága",openClosestDetails:true},
      {selector:'input[name="settlement"]',title:"3. Település",body:"Add meg azt a települést, ahol a gazdaság jellemzően található vagy ahonnan működik.",example:"Példa: Nagykáta",openClosestDetails:true},
      {selector:'input[name="address"]',title:"4. Cím",body:"Itt rögzítheted a gazdaság címét vagy telephelyét. Ha nincs szükség pontos utcacímre, ez a mező üresen is hagyható.",example:"Példa: 2760 Nagykáta, Minta út 12.",openClosestDetails:true},
      {selector:'form[action] button.btn-secondary',title:"5. Gazdaság létrehozása",body:"Ha minden adat rendben van, nyomd meg a Gazdaság létrehozása gombot. Ezzel elkészül a gazdaság, és utána már hozzáadhatod a földtáblákat.",example:"A gomb megnyomása után a gazdaság megjelenik az ügyfél adatlapján.",openClosestDetails:true}
    ]
  },
  "create-operation":{
    route:"/operations",
    title:"Művelet rögzítése lépésről lépésre",
    intro:"Ez a részletes oktató mód mezőről mezőre végigvisz egy új művelet rögzítésén. A megjelenő mezők a választott művelettípustól és az ország hivatalos katalógusától függhetnek.",
    steps:[
      {selector:'select[name="field_id"]',title:"1. Földtábla",body:"Válaszd ki azt a földtáblát, ahol a munkát elvégezték vagy el fogják végezni. A kiválasztott tábla gazdasága határozza meg a HU vagy SK szabályozási környezetet.",example:"Példa: Déli 12 – Kovács gazdaság (12,4 ha)"},
      {selector:'input[name="operation_date"]',title:"2. Művelet dátuma",body:"Add meg a tényleges vagy tervezett műveleti dátumot. Növényvédelmi ellenőrzéseknél a rendszer ehhez a dátumhoz vizsgálja a készítmény alkalmazhatóságát."},
      {selector:'select[name="operation_type"]',title:"3. Művelet típusa",body:"Válaszd ki, milyen munkát rögzítesz: például permetezés, növényvédelem, tápanyag-kijuttatás, vetés vagy talajmunka.",example:"Példa: Növényvédelem"},
      {selector:'select[name="product_id"]',title:"4. Hivatalos készítmény",body:"Ha növényvédelmi műveletet választottál és van hivatalos katalógusadat, itt válaszd ki a készítményt. A rendszer az ország és a kultúra alapján szűri a lehetőségeket.",optional:true},
      {selector:'select[name="use_id"]',title:"5. Engedélyezett felhasználás",body:"Válaszd ki a konkrét engedélyezett felhasználást vagy célkárosítót. Ehhez tartozik a hivatalos dózistartomány és szükség esetén a várakozási idő.",optional:true},
      {selector:'select[name="dose_mode"]',title:"6. Dózis módja",body:"Választhatod a hivatalos maximális dózist, vagy egyéni dózist adhatsz meg. Egyéni dózis esetén a rendszer nem enged a hivatalos maximumnál nagyobb értéket.",optional:true},
      {selector:'input[name="dose"]',title:"7. Egyéni dózis",body:"Ha egyéni dózist választottál, itt add meg az alkalmazott mennyiséget. Maradj az engedélyezett tartományon belül.",optional:true},
      {selector:'select[name="requested_approver_id"]',title:"8. Jogosult jóváhagyó",body:"Engedélyköteles készítménynél a gazdaság saját jogosult személyét kell kiválasztani. A szaktanácsadó szakmai javaslata nem helyettesíti ezt a gazdasági jóváhagyást.",optional:true},
      {selector:'textarea[name="notes"]',title:"9. Megjegyzés",body:"Itt rögzíthetsz minden olyan körülményt, amely később fontos lehet: például időjárási körülmény, megfigyelés vagy végrehajtási megjegyzés.",optional:true},
      {selector:'form.operation-form button[type="submit"]',title:"10. Művelet mentése",body:"Ellenőrizd a megadott adatokat, majd nyomd meg a mentés gombot. Ha a rendszer szabályozási hibát vagy hiányzó jóváhagyást talál, a mentés előtt figyelmeztet vagy blokkol.",optional:true}
    ]
  }
};

const STORE="agrar-mentor-process-guide";

export function ProcessGuideProvider(){
  const[guideId,setGuideId]=useState<GuideId|null>(null);
  const[index,setIndex]=useState(0);
  const[rect,setRect]=useState<DOMRect|null>(null);
  const guide=guideId?guides[guideId]:null;
  const steps=useMemo(()=>guide?.steps||[],[guide]);

  useEffect(()=>{
    const start=(event:Event)=>{const id=(event as CustomEvent<GuideId>).detail;if(id&&guides[id])begin(id)};
    window.addEventListener("agrar-process-guide",start as EventListener);
    try{const pending=sessionStorage.getItem(STORE) as GuideId|null;if(pending&&guides[pending]&&location.pathname===guides[pending].route){sessionStorage.removeItem(STORE);setTimeout(()=>{setGuideId(pending);setIndex(0)},250)}}catch{}
    return()=>window.removeEventListener("agrar-process-guide",start as EventListener);
  },[]);

  useEffect(()=>{
    if(!guide)return;
    const step=steps[index];if(!step){close();return}
    let timer:number|undefined;
    const locate=()=>{
      const target=document.querySelector(step.selector) as HTMLElement|null;
      if(!target){if(step.optional){next();return}setRect(null);return}
      if(step.openClosestDetails){const details=target.closest("details") as HTMLDetailsElement|null;if(details)details.open=true}
      const focus=target.closest("label") as HTMLElement|null||target;
      focus.scrollIntoView({behavior:"smooth",block:"center"});
      timer=window.setTimeout(()=>setRect(focus.getBoundingClientRect()),180);
    };
    locate();window.addEventListener("resize",locate);window.addEventListener("scroll",locate,true);
    return()=>{if(timer)clearTimeout(timer);window.removeEventListener("resize",locate);window.removeEventListener("scroll",locate,true)};
  },[guideId,index,steps]);

  function begin(id:GuideId){const g=guides[id];if(location.pathname!==g.route){try{sessionStorage.setItem(STORE,id)}catch{}location.href=g.route;return}setGuideId(id);setIndex(0)}
  function close(){setGuideId(null);setRect(null);setIndex(0)}
  function next(){if(!guide)return;if(index>=steps.length-1)close();else setIndex(i=>i+1)}
  function prev(){setIndex(i=>Math.max(0,i-1))}
  if(!guide)return null;
  const step=steps[index];
  const cardStyle:React.CSSProperties=rect?{top:Math.max(16,Math.min(window.innerHeight-360,rect.bottom+14)),left:Math.max(16,Math.min(window.innerWidth-396,rect.left))}:{};
  return <>
    {rect&&<div className={styles.spotlight} style={{left:rect.left-6,top:rect.top-6,width:rect.width+12,height:rect.height+12}}/>}
    <div className={styles.card} style={cardStyle}>
      <button className={styles.close} onClick={close} aria-label="Részletes útmutató bezárása">×</button>
      <span className={styles.eyebrow}>Részletes oktató mód · {index+1}/{steps.length}</span>
      <h3>{step.title}</h3><p>{step.body}</p>
      {step.example&&<div className={styles.example}><strong>Gyakorlati példa</strong><span>{step.example}</span></div>}
      {!rect&&!step.optional&&<div className={styles.warning}>A magyarázandó mező még nem látható. Nyisd meg a szükséges részt, vagy ellenőrizd, hogy az előző lépést kitöltötted-e.</div>}
      <div className={styles.progress}><span style={{width:`${((index+1)/steps.length)*100}%`}}/></div>
      <div className={styles.actions}><button className={styles.ghost} onClick={close}>Kilépés</button><div>{index>0&&<button className={styles.ghost} onClick={prev}>Vissza</button>}<button className={styles.button} onClick={next}>{index===steps.length-1?"Befejezés":"Tovább"}</button></div></div>
    </div>
  </>;
}

export function ProcessGuideButton({guide,label}:{guide:GuideId;label?:string}){
  const cfg=guides[guide];
  return <button type="button" className={styles.launch} onClick={()=>window.dispatchEvent(new CustomEvent("agrar-process-guide",{detail:guide}))}>{label||cfg.title}</button>;
}
