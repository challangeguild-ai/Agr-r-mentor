"use client";
import {useCallback,useEffect,useLayoutEffect,useState} from "react";

const steps=[
 {selector:'[data-admin-tour="admin-home"]',title:"Rendszeráttekintés",text:"Itt látod a teljes Agrár Mentor rendszer állapotát: felhasználókat, gazdaságokat, feladatokat és biztonsági jelzéseket."},
 {selector:'[data-admin-tour="admin-support"]',title:"Támogatási központ",text:"Itt vizsgálhatod és indoklással javíthatod a felhasználói munkafolyamatok problémás állapotait. Az admin beavatkozás auditnaplóba kerül."},
 {selector:'[data-admin-tour="admin-users"]',title:"Felhasználók",text:"A rendszer szerepkörei és a rendszeradminisztrátori jogosultság külön látható. A gazdálkodói és szaktanácsadói üzleti szerepkört nem keverjük az adminjoggal."},
 {selector:'[data-admin-tour="admin-security"]',title:"Biztonsági események",text:"Itt jelennek meg a magasabb kockázatú hitelesítési, jogosultsági és exportesemények, IP- és időadatokkal."},
 {selector:'[data-admin-tour="admin-backup"]',title:"Kiemelten védett export",text:"A teljes adatmentés külön friss authenticator-kódot kér akkor is, ha már kétfaktorosan jelentkeztél be."},
];
type Box={top:number;left:number;width:number;height:number};
type Pos={top:number;left:number};
const PAD=8,CARD_W=390,GAP=14;

function measure(el:HTMLElement):Box{const r=el.getBoundingClientRect();return{top:Math.max(6,r.top-PAD),left:Math.max(6,r.left-PAD),width:Math.min(window.innerWidth-12,r.width+PAD*2),height:r.height+PAD*2}}
function place(b:Box):Pos{const w=Math.min(CARD_W,window.innerWidth-24),h=270;let top=b.top+b.height+GAP;if(top+h>window.innerHeight-12)top=b.top-h-GAP;if(top<12)top=Math.max(12,window.innerHeight-h-12);let left=b.left;if(left+w>window.innerWidth-12)left=window.innerWidth-w-12;return{top,left:Math.max(12,left)}}

export function SystemAdminTour(){
 const key="agrar-mentor-system-admin-tour:v2";const[index,setIndex]=useState<number|null>(null);const[box,setBox]=useState<Box|null>(null);const[pos,setPos]=useState<Pos>({top:20,left:20});
 useEffect(()=>{try{if(!localStorage.getItem(key))setIndex(0)}catch{}},[]);
 const sync=useCallback(()=>{if(index===null)return;const el=document.querySelector(steps[index]?.selector||"") as HTMLElement|null;if(!el){setBox(null);return}const b=measure(el);setBox(b);setPos(place(b))},[index]);
 useLayoutEffect(()=>{if(index===null)return;const el=document.querySelector(steps[index]?.selector||"") as HTMLElement|null;if(!el)return;el.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});const t=window.setTimeout(sync,260);sync();window.addEventListener("resize",sync);window.addEventListener("scroll",sync,true);return()=>{clearTimeout(t);window.removeEventListener("resize",sync);window.removeEventListener("scroll",sync,true)}},[index,sync]);
 function restart(){try{localStorage.removeItem(key)}catch{}setIndex(0)}function close(){try{localStorage.setItem(key,new Date().toISOString())}catch{}setIndex(null);setBox(null)}function next(){setIndex(p=>p===null?null:p>=steps.length-1?(close(),null):p+1)}function prev(){setIndex(p=>p===null?null:Math.max(0,p-1))}
 if(index===null)return <button type="button" onClick={restart} aria-label="Rendszeradmin virtuális túra újraindítása" style={{position:"fixed",right:18,bottom:18,zIndex:190,border:"1px solid #8f2631",borderRadius:999,padding:"10px 14px",background:"white",color:"#8f2631",fontWeight:800,boxShadow:"0 8px 28px rgba(50,0,7,.16)",cursor:"pointer"}}>Virtuális túra</button>;
 const step=steps[index];if(!step)return null;
 return <>{box&&<div aria-hidden="true" style={{position:"fixed",top:box.top,left:box.left,width:box.width,height:box.height,zIndex:10001,borderRadius:14,boxShadow:"0 0 0 9999px rgba(12,15,13,.74),0 0 0 3px #fff,0 0 0 6px #8f2631",pointerEvents:"none",transition:"all .22s ease"}}/>}<section role="dialog" aria-modal="true" aria-label={`Virtuális túra: ${step.title}`} style={{position:"fixed",top:pos.top,left:pos.left,zIndex:10002,width:`min(${CARD_W}px,calc(100vw - 24px))`,maxHeight:"min(420px,calc(100vh - 24px))",overflow:"auto",background:"white",border:"2px solid #9b2c37",borderRadius:16,padding:18,boxShadow:"0 18px 55px rgba(0,0,0,.3)",transition:"top .2s ease,left .2s ease"}}><small style={{fontWeight:900,color:"#9b2c37"}}>RENDSZERADMIN TÚRA · {index+1}/{steps.length}</small><h3 style={{margin:"8px 0"}}>{step.title}</h3><p style={{margin:"0 0 14px",lineHeight:1.55,color:"#5f5557"}}>{step.text}</p><div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}><button type="button" className="ghost-btn" onClick={close}>Kihagyás</button><div style={{display:"flex",gap:8}}>{index>0&&<button type="button" className="ghost-btn" onClick={prev}>Vissza</button>}<button type="button" className="btn btn-primary" style={{background:"#8f2631"}} onClick={next}>{index===steps.length-1?"Befejezés":"Tovább"}</button></div></div></section></>
}
