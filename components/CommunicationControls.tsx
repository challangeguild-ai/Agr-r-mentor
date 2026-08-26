"use client";
import {useEffect,useState} from "react";
import {createPersonalFollowup,markCommunicationSeen} from "@/app/contact-actions";

export function CommunicationSeenMarker({entityType,entityId}:{entityType:"farmer_report"|"inspection"|"task"|"advisor_message";entityId:string}){useEffect(()=>{markCommunicationSeen(entityType,entityId).catch(()=>{})},[entityType,entityId]);return null}

function localDateTime(ms:number){const d=new Date(Date.now()+ms);const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16)}
export function RemindLaterButton({entityType,entityId,title,href}:{entityType:"farmer_report"|"inspection"|"task"|"advisor_message";entityId:string;title:string;href:string}){
 const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 async function schedule(remindAt:string){setBusy(true);const f=new FormData();f.set("entity_type",entityType);f.set("entity_id",entityId);f.set("title",title);f.set("href",href);f.set("remind_at",new Date(remindAt).toISOString());try{await createPersonalFollowup(f);setDone(true);setOpen(false)}finally{setBusy(false)}}
 if(done)return <span className="user-pill">🔔 Emlékeztető beállítva</span>;
 return <div style={{position:"relative",display:"inline-block"}}><button type="button" className="ghost-btn" onClick={()=>setOpen(v=>!v)}>🔔 Emlékeztess később</button>{open&&<div style={{position:"absolute",zIndex:20,right:0,top:"calc(100% + 6px)",width:260,padding:10,border:"1px solid #dfe6df",borderRadius:10,background:"#fff",boxShadow:"0 10px 30px rgba(0,0,0,.12)",display:"grid",gap:7}}><button disabled={busy} className="ghost-btn" onClick={()=>schedule(localDateTime(60*60*1000))}>1 óra múlva</button><button disabled={busy} className="ghost-btn" onClick={()=>schedule(localDateTime(4*60*60*1000))}>Később ma</button><button disabled={busy} className="ghost-btn" onClick={()=>schedule(localDateTime(24*60*60*1000))}>Holnap</button><button disabled={busy} className="ghost-btn" onClick={()=>schedule(localDateTime(3*24*60*60*1000))}>3 nap múlva</button><label style={{fontSize:12,fontWeight:700}}>Egyéni időpont<input type="datetime-local" min={localDateTime(5*60*1000)} onChange={e=>{if(e.target.value)schedule(e.target.value)}}/></label><small>Ez privát emlékeztető. A másik fél nem látja.</small></div>}</div>
}

export function SeenStatus({seenAt,viewerLabel}:{seenAt?:string|null;viewerLabel:string}){if(!seenAt)return <small style={{color:"#8a958f"}}>Még nem látta</small>;return <small style={{color:"#39732b",fontWeight:700}}>✓✓ {viewerLabel} látta · {new Date(seenAt).toLocaleString("hu-HU",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small>}
