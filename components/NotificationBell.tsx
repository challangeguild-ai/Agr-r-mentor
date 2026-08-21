"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type Notification={id:string;kind:string;title:string;message:string|null;href:string|null;read_at:string|null;created_at:string};

export function NotificationBell(){
  const supabase=useMemo(()=>createClient(),[]);
  const[items,setItems]=useState<Notification[]>([]);
  const[open,setOpen]=useState(false);
  useEffect(()=>{let alive=true;(async()=>{const{data}=await supabase.from("notifications").select("id,kind,title,message,href,read_at,created_at").order("created_at",{ascending:false}).limit(20);if(alive)setItems((data??[]) as Notification[])})();return()=>{alive=false}},[supabase]);
  const unread=items.filter(x=>!x.read_at).length;
  async function markRead(id:string){const now=new Date().toISOString();await supabase.from("notifications").update({read_at:now}).eq("id",id);setItems(prev=>prev.map(x=>x.id===id?{...x,read_at:now}:x))}
  async function markAll(){const now=new Date().toISOString();await supabase.from("notifications").update({read_at:now}).is("read_at",null);setItems(prev=>prev.map(x=>({...x,read_at:x.read_at||now})))}
  return <div className="notification-wrap">
    <button className="notification-bell" type="button" onClick={()=>setOpen(v=>!v)} aria-label="Értesítések">🔔{unread>0&&<span>{unread>9?"9+":unread}</span>}</button>
    {open&&<div className="notification-popover">
      <div className="notification-head"><strong>Értesítések</strong>{unread>0&&<button type="button" onClick={markAll}>Mind olvasott</button>}</div>
      {items.length?<div className="notification-list">{items.map(item=><Link key={item.id} href={item.href||"#"} onClick={()=>markRead(item.id)} className={`notification-item ${item.read_at?"":"unread"}`}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<small>{new Date(item.created_at).toLocaleString("hu-HU")}</small></div></Link>)}</div>:<div className="notification-empty">Nincs új értesítés.</div>}
    </div>}
  </div>
}
