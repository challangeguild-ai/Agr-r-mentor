import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Sidebar} from "@/components/Sidebar";
import {FarmerTopbar} from "@/components/FarmerTopbar";
import {BlockHelpButton} from "@/components/GuidedTour";
import {CommunicationOpenMarker,RemindLaterButton} from "@/components/CommunicationControls";
import styles from "./messages.module.css";

type SearchParams=Promise<{view?:string;id?:string}>;
function statusLabel(v:string){if(v==="reviewed")return"Megválaszolva";if(v==="closed")return"Lezárva";return"Válaszra vár"}

export default async function MessagesPage({searchParams}:{searchParams:SearchParams}){
 const{view="all",id=""}=await searchParams;
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:profile}=await supabase.from("profiles").select("full_name,role,system_role").eq("id",user.id).maybeSingle();
 if(profile?.system_role==="admin")redirect("/system-admin");if(profile?.role==="advisor")redirect("/admin/reports");

 const{data:reports}=await supabase.from("farmer_reports").select("id,field_id,title,message,status,created_at,advisor_reply,replied_at").eq("farmer_id",user.id).order("created_at",{ascending:false});
 const fieldIds=[...new Set((reports??[]).map(r=>r.field_id).filter(Boolean))] as string[];
 const{data:fields}=fieldIds.length?await supabase.from("fields").select("id,name").in("id",fieldIds):{data:[]};
 const fieldMap=new Map((fields??[]).map(f=>[f.id,f.name]));
 const all=reports??[],waiting=all.filter(r=>r.status!=="reviewed"&&r.status!=="closed"),answered=all.filter(r=>r.status==="reviewed"),closed=all.filter(r=>r.status==="closed");
 const visible=all.filter(r=>view==="waiting"?r.status!=="reviewed"&&r.status!=="closed":view==="answered"?r.status==="reviewed":view==="closed"?r.status==="closed":true);
 const selected=all.find(r=>r.id===id)||null;
 const selectedField=selected?.field_id?fieldMap.get(selected.field_id):null;
 const hrefFor=(rid:string)=>`/messages?view=${encodeURIComponent(view)}&id=${encodeURIComponent(rid)}`;

 return <div className="app-shell farmer-app">
  <Sidebar active="messages" userName={profile?.full_name||"Gazdálkodó"}/>
  <main className={`dashboard ${styles.page}`}>
   <FarmerTopbar userName={profile?.full_name||"Gazdálkodó"} placeholder="Keresés üzenetek, táblák vagy témák között…"/>
   <section className={styles.titleRow}>
    <div><h1>Üzenetek</h1><p>Kommunikálj a szaktanácsadóddal, és kövesd a szakmai válaszokat.</p></div>
    <div className={styles.titleActions}><BlockHelpButton label="Az üzenetek magyarázata" content={{title:"Üzenetek",body:"A bal oldali listából válassz beszélgetést. A tartalom megnyitása külön szakmai megtekintésnek számít.",important:"A lista megjelenítése önmagában nem jelenti azt, hogy a tartalmat elolvastad."}}/><Link className={styles.primary} href="/fields">+ Új bejelentés</Link></div>
   </section>

   <nav className={styles.tabs}><Link className={view==="all"?styles.active:""} href="/messages?view=all">Összes <span>{all.length}</span></Link><Link className={view==="waiting"?styles.active:""} href="/messages?view=waiting">Válaszra vár <span>{waiting.length}</span></Link><Link className={view==="answered"?styles.active:""} href="/messages?view=answered">Megválaszolva <span>{answered.length}</span></Link><Link className={view==="closed"?styles.active:""} href="/messages?view=closed">Lezárt <span>{closed.length}</span></Link></nav>

   <section className={`${styles.workspace} ${selected?styles.hasSelection:""}`}>
    <aside className={styles.conversations}>
     {visible.length?visible.map(r=><Link key={r.id} href={hrefFor(r.id)} className={`${styles.conversation} ${selected?.id===r.id?styles.selected:""}`}>
      <span className={styles.avatar}>{r.advisor_reply?"A":"!"}</span>
      <div><div className={styles.conversationHead}><strong>{r.title}</strong><time>{new Date(r.created_at).toLocaleDateString("hu-HU",{month:"2-digit",day:"2-digit"})}</time></div><small>{fieldMap.get(r.field_id)||"Földtábla"}</small><p>{r.advisor_reply||r.message||"Nincs előnézet."}</p></div>
      <span className={`${styles.status} ${r.status==="reviewed"?styles.answered:r.status==="closed"?styles.closed:styles.waiting}`}>{statusLabel(r.status)}</span>
     </Link>):<div className={styles.empty}>Ebben a nézetben nincs üzenet.</div>}
    </aside>

    <article className={styles.thread}>
     {selected?<><CommunicationOpenMarker entityType="farmer_report" entityId={selected.id}/>
      <header className={styles.threadHead}><div className={styles.threadIdentity}><Link className={styles.mobileBack} href={`/messages?view=${encodeURIComponent(view)}`}>←</Link><span className={styles.threadAvatar}>A</span><div><strong>Szaktanácsadói beszélgetés</strong><small>{selectedField||"Földtábla"} · {statusLabel(selected.status)}</small></div></div><div className={styles.threadTools}>{selected.field_id&&<Link href={`/fields/${selected.field_id}`}>Tábla megnyitása</Link>}<RemindLaterButton entityType="farmer_report" entityId={selected.id} title={selected.title} href={hrefFor(selected.id)}/></div></header>
      <div className={styles.threadBody}>
       <div className={styles.dayLabel}>{new Date(selected.created_at).toLocaleDateString("hu-HU",{year:"numeric",month:"long",day:"numeric"})}</div>
       <div className={styles.outgoing}><div><strong>{profile?.full_name||"Gazdálkodó"}</strong><p>{selected.message}</p><small>{new Date(selected.created_at).toLocaleTimeString("hu-HU",{hour:"2-digit",minute:"2-digit"})}</small></div></div>
       {selected.advisor_reply?<div className={styles.incoming}><span className={styles.messageAvatar}>A</span><div><strong>Szaktanácsadó</strong><p>{selected.advisor_reply}</p><small>{selected.replied_at?new Date(selected.replied_at).toLocaleString("hu-HU",{hour:"2-digit",minute:"2-digit"}):""}</small></div></div>:<div className={styles.waitingReply}>A bejelentés válaszra vár.</div>}
      </div>
      <footer className={styles.composer}><span>Az új bejelentést az érintett földtábla adatlapjáról indíthatod.</span>{selected.field_id&&<Link href={`/fields/${selected.field_id}`}>Új bejelentés →</Link>}</footer>
     </>:<div className={styles.threadEmpty}><span>✉</span><strong>Válassz egy beszélgetést</strong><p>A bal oldali listából nyiss meg egy bejelentést vagy szakmai választ.</p></div>}
    </article>
   </section>
  </main>
 </div>;
}
