"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export type HuSyncResult={ok:boolean;error?:string;rows?:number;inserted_products?:number;updated_products?:number;source_url?:string};

const SNAPSHOT_URL="https://raw.githubusercontent.com/challangeguild-ai/Agr-r-mentor/main/data/official/nebih/withdrawn_products.csv";

function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i],next=text[i+1];
  if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;continue}
  if(ch==='"'){quoted=!quoted;continue}
  if(ch===','&&!quoted){row.push(cell);cell="";continue}
  if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";continue}
  cell+=ch;
 }
 row.push(cell);if(row.some(Boolean))rows.push(row);
 if(rows.length<2)return[];
 const header=rows[0].map(x=>x.trim());
 return rows.slice(1).map(r=>Object.fromEntries(header.map((h,i)=>[h,(r[i]||"").trim()]))).filter(r=>r.name);
}

async function advisor(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="advisor")throw new Error("Csak szaktanácsadó/admin indíthat Nébih snapshot-frissítést.");
 return supabase;
}

export async function syncNebihWithdrawnSnapshot():Promise<HuSyncResult>{
 try{
  const supabase=await advisor();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  const res=await fetch(SNAPSHOT_URL,{cache:"no-store",signal:controller.signal,headers:{"user-agent":"Agrar-Mentor/1.0 official-nebih-snapshot"}});clearTimeout(timer);
  if(!res.ok)return{ok:false,error:`A Nébih GitHub snapshot nem érhető el: HTTP ${res.status}.`};
  const rows=parseCsv(await res.text());
  if(!rows.length)return{ok:false,error:"A Nébih snapshot letöltődött, de nem tartalmaz feldolgozható készítménysorokat."};
  const CHUNK=500;let inserted=0,updated=0;
  for(let i=0;i<rows.length;i+=CHUNK){
   const{data,error}=await supabase.rpc("import_hu_nebih_regulatory_snapshot",{p_rows:rows.slice(i,i+CHUNK),p_source_name:"Nébih – visszavont és lejárt szerek"});
   if(error)throw new Error(error.message);
   inserted+=Number(data?.inserted_products||0);updated+=Number(data?.updated_products||0);
  }
  revalidatePath("/admin/plant-protection-import");revalidatePath("/operations");
  return{ok:true,rows:rows.length,inserted_products:inserted,updated_products:updated,source_url:SNAPSHOT_URL};
 }catch(e){return{ok:false,error:e instanceof Error?e.message:"A Nébih snapshot frissítése ismeretlen hiba miatt megszakadt."}}
}
