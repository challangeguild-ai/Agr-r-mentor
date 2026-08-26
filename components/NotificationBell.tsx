"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type Notification={id:string;user_id?:string;kind:string;title:string;message:string|null;href:string|null;read_at:string|null;created_at:string};

export function NotificationBell(){
 const supabase=useMemo(()=>createClient(),[]);
 const[items,setItems]=useState<Notification[]>([]),[unread,setUnread]=useState(0),[open,setOpen]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{
  let alive=true;let channel:any=null;
  (async()=>{
   const{data:{user}}=await supabase.auth.getUser();
   if(!user){if(alive)setLoading(false);return}
   const[{data,error:loadError},{count,error:countError}]=await Promise.all([
    supabase.from("notifications").select("id,user_id,kind,title,message,href,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
    supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("read_at",null),
   ]);
   if(!alive)return;
   if(loadError||countError)setError("Az értesítések most nem tölthetők be.");
   else{setItems((data??[]) as Notification[]);setUnread(count??0)}
   setLoading(false);
   channel=supabase.channel(`notification-bell-${user.id}`).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${user.id}`},payload=>{
    if(!alive)return;
    if(payload.eventType==="INSERT"){
     const item=payload.new as Notification;setItems(prev=>[item,...prev.filter(x=>x.id!==item.id)].slice(0,20));if(!item.read_at)setUnread(v=>v+1);
    }else if(payload.eventType==="UPDATE"){
     const item=payload.new as Notification;setItems(prev=>{const old=prev.find(x=>x.id===item.id);if(old&&!old.read_at&&item.read_at)setUnread(v=>Math.max(0,v-1));if(old&&old.read_at&&!item.read_at)setUnread(v=>v+1);return prev.map(x=>x.id===item.id?item:x)});
    }else if(payload.eventType==="DELETE"){
     const old=payload.old as Notification;setItems(prev=>prev.filter(x=>x.id!==old.id));if(!old.read_at)setUnread(v=>Math.max(0,v-1));
    }
   }).subscribe();
  })();
  return()=>{alive=false;if(channel)void supabase.removeChannel(channel)};
 },[supabase]);
 async function markRead(id:string){const{data:{user}}=await supabase.auth.getUser();if(!user)return;const item=items.find(x=>x.id===id);if(item?.read_at)return;const now=new Date().toISOString();const{error:updateError}=await supabase.from("notifications").update({read_at:now}).eq("id",id).eq("user_id",user.id);if(updateError){setError("Az értesítés nem jelölhető olvasottnak.");return}setItems(prev=>prev.map(x=>x.id===id?{...x,read_at:now}:x));setUnread(v=>Math.max(0,v-1))}
 async function markAll(){const{data:{user}}=await supabase.auth.getUser();if(!user)return;const now=new Date().toISOString();const{error:updateError}=await supabase.from("notifications").update({read_at:now}).eq("user_id",user.id).is("read_at",null);if(updateError){setError("Az értesítések nem jelölhetők olvasottnak.");return}setItems(prev=>prev.map(x=>({...x,read_at:x.read_at||now})));setUnread(0)}
 return <div className="notification-wrap">
  <button className="notification-bell" type="button" onClick={()=>setOpen(v=>!v)} aria-label={`Értesítések${unread?`, ${unread} olvasatlan`:""}`} aria-expanded={open}>🔔{unread>0&&<span>{unread>99?"99+":unread}</span>}</button>
  {open&&<div className="notification-popover">
   <div className="notification-head"><strong>Értesítések{unread>0?` · ${unread} új`:""}</strong>{unread>0&&<button type="button" onClick={markAll}>Mind olvasott</button>}</div>
   {error&&<div className="notification-empty">{error}</div>}
   {loading?<div className="notification-empty">Betöltés…</div>:items.length?<div className="notification-list">{items.map(item=><Link key={item.id} href={item.href||"/notifications"} onClick={()=>{void markRead(item.id);setOpen(false)}} className={`notification-item ${item.read_at?"":"unread"}`}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<small>{new Date(item.created_at).toLocaleString("hu-HU")}</small></div></Link>)}</div>:!error&&<div className="notification-empty">Nincs értesítés.</div>}
   <div style={{padding:"10px 12px",borderTop:"1px solid #e5e9e4",textAlign:"center"}}><Link href="/notifications" onClick={()=>setOpen(false)} style={{fontSize:11,fontWeight:800,color:"#39752f"}}>Összes értesítés megnyitása →</Link></div>
  </div>}
 </div>
}
