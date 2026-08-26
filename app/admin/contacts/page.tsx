import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {AdminNav} from "@/components/AdminNav";
import {ContactFields,ContactLinks} from "@/components/ContactFields";
import {saveFarmContacts,saveProfileContacts} from "@/app/contact-actions";

export default async function ContactsPage(){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const{data:me}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();if(me?.role!=="advisor")redirect("/dashboard");
 const[{data:farms},{data:farmContacts},{data:profileContacts}]=await Promise.all([
  supabase.from("farms").select("id,name,owner_id,settlement").order("name"),
  supabase.from("farm_contacts").select("id,farm_id,contact_type,label,value,is_primary").order("is_primary",{ascending:false}),
  supabase.from("profile_contacts").select("id,profile_id,contact_type,label,value,is_primary").eq("profile_id",user.id).order("is_primary",{ascending:false})
 ]);
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">KAPCSOLATTARTÁS</span><h1>Elérhetőségek</h1><p>Gazdasági kapcsolattartók és a gazdálkodók számára megosztott szaktanácsadói elérhetőségek.</p></div></header><AdminNav active="clients"/>
 <section className="panel" style={{marginBottom:14}}><div className="panel-heading"><div><span className="eyebrow">SAJÁT ELÉRHETŐSÉG</span><h2>Szaktanácsadói kapcsolat</h2><p>Ezeket az elérhetőségeket a gazdálkodók közvetlen híváshoz és e-mail íráshoz használhatják.</p></div></div><form action={saveProfileContacts} className="admin-form" style={{padding:14}}><ContactFields initialContacts={(profileContacts??[]).map(c=>({...c,contact_type:c.contact_type as "phone"|"email"}))}/><button className="btn btn-primary" type="submit">Saját elérhetőségek mentése</button></form></section>
 <section className="panel"><div className="panel-heading"><div><span className="eyebrow">GAZDASÁGI KAPCSOLATTARTÓK</span><h2>Telefonszámok és e-mail címek</h2><p>Az adatok bármikor szerkeszthetők, törölhetők vagy elsődlegesként jelölhetők.</p></div></div><div style={{display:"grid",gap:14,padding:14}}>{(farms??[]).map(f=>{const contacts=(farmContacts??[]).filter(c=>c.farm_id===f.id);return <article key={f.id} style={{border:"1px solid #e2e8e2",borderRadius:12,padding:14,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:12}}><div><strong>{f.name}</strong><small style={{display:"block"}}>{f.settlement||"Nincs település"}</small></div>{contacts.length>0&&<div style={{minWidth:0,maxWidth:420}}><ContactLinks contacts={contacts}/></div>}</div><form action={saveFarmContacts} className="admin-form"><input type="hidden" name="farm_id" value={f.id}/><ContactFields initialContacts={contacts.map(c=>({...c,contact_type:c.contact_type as "phone"|"email"}))}/><button className="btn btn-secondary" type="submit">Kapcsolattartók mentése</button></form></article>})}</div></section></main>
}
