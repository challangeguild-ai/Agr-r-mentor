"use client";
import {useEffect,useState} from "react";

const steps=[
 {selector:'[data-admin-tour="admin-home"]',title:"Rendszeráttekintés",text:"Itt látod a teljes Agrár Mentor rendszer állapotát: felhasználókat, gazdaságokat, feladatokat és biztonsági jelzéseket."},
 {selector:'[data-admin-tour="admin-support"]',title:"Támogatási központ",text:"Itt vizsgálhatod és indoklással javíthatod a felhasználói munkafolyamatok problémás állapotait. Az admin beavatkozás auditnaplóba kerül."},
 {selector:'[data-admin-tour="admin-users"]',title:"Felhasználók",text:"A rendszer szerepkörei és a rendszeradminisztrátori jogosultság külön látható. A gazdálkodói és szaktanácsadói üzleti szerepkört nem keverjük az adminjoggal."},
 {selector:'[data-admin-tour="admin-security"]',title:"Biztonsági események",text:"Itt jelennek meg a magasabb kockázatú hitelesítési, jogosultsági és exportesemények, IP- és időadatokkal."},
 {selector:'[data-admin-tour="admin-backup"]',title:"Kiemelten védett export",text:"A teljes adatmentés külön friss authenticator-kódot kér akkor is, ha már kétfaktorosan jelentkeztél be."},
];

export function SystemAdminTour(){
 const[key]=useState("agrar-mentor-system-admin-tour:v1");
 const[index,setIndex]=useState<number|null>(null);
 useEffect(()=>{try{if(!localStorage.getItem(key))setIndex(0)}catch{}},[key]);
 if(index===null)return null;
 const currentIndex=index;
 const step=steps[currentIndex];
 if(!step)return null;
 function close(){try{localStorage.setItem(key,new Date().toISOString())}catch{}setIndex(null)}
 function next(){setIndex(prev=>{if(prev===null)return null;if(prev>=steps.length-1){try{localStorage.setItem(key,new Date().toISOString())}catch{}return null}return prev+1})}
 return <div style={{position:"fixed",right:18,bottom:18,zIndex:200,width:"min(390px,calc(100vw - 36px))",background:"white",border:"2px solid #9b2c37",borderRadius:16,padding:18,boxShadow:"0 18px 55px rgba(50,0,7,.24)"}}><small style={{fontWeight:900,color:"#9b2c37"}}>RENDSZERADMIN TÚRA · {currentIndex+1}/{steps.length}</small><h3 style={{margin:"8px 0"}}>{step.title}</h3><p style={{margin:"0 0 14px",lineHeight:1.55,color:"#5f5557"}}>{step.text}</p><div style={{display:"flex",gap:8,justifyContent:"space-between"}}><button type="button" className="ghost-btn" onClick={close}>Kihagyás</button><button type="button" className="btn btn-primary" style={{background:"#8f2631"}} onClick={next}>{currentIndex===steps.length-1?"Befejezés":"Tovább"}</button></div></div>
}
