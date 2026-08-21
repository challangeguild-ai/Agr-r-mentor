"use client";
import {useState} from "react";
import {createClient} from "@/lib/supabase/client";

export function LogoutButton({className="portal-logout"}:{className?:string}){
  const[busy,setBusy]=useState(false);
  async function logout(){
    if(busy)return;
    setBusy(true);
    const supabase=createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }
  return <button type="button" className={className} onClick={logout} disabled={busy}><span>↪</span>{busy?"Kilépés…":"Kijelentkezés"}</button>;
}
