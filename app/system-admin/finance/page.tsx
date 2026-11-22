import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import {grantAdvisorFinance,revokeAdvisorFinance} from "../actions";

export const dynamic="force-dynamic";
export default async function FinanceAccessPage({searchParams}:{searchParams:Promise<{result?:string}>}){
 const admin=createAdminClient();
 const [{data:farms,error:fe},{data:profiles,error:pe},{data:grants,error:ge}]=await Promise.all([
  admin.from("farms").select("id,name,owner_id").order("name"),
  admin.from("profiles").select("id,full_name,role,system_role"),
  admin.from("farm_advisor_finance_grants").select("farm_id,owner_id,advisor_id,authorization_reference,granted_at,revoked_at").order("granted_at",{ascending:false})
 ]);
 if(fe||pe||ge)throw new Error("A pénzügyi hozzáférések nyilvántartása nem tölthető be.");
 const advisors=(profiles??[]).filter(p=>p.role==="advisor"&&(p.system_role??"user")==="user");
 const names=new Map((profiles??[]).map(p=>[p.id,p.full_name??"Névtelen"]));
 const farmNames=new Map((farms??[]).map(f=>[f.id,f.name]));
 const owners=new Map((farms??[]).map(f=>[f.id,f.owner_id]));
 const active=(grants??[]).filter(g=>!g.revoked_at);
 const query=await searchParams;
 return <main className="admin-shell"><header className="admin-header"><div><span className="eyebrow">RENDSZERADMIN · PÉNZÜGYI JOGOSULTSÁG</span><h1>Szaktanácsadói pénzügyi hozzáférések</h1><p>Gazdaságonként és személyenként dokumentált, visszavonható betekintések.</p></div></header>
  {query.result&&<p className="notice" role="status">{query.result==="granted"?"A jogosultság naplózva rögzítve.":"A jogosultság naplózva visszavonva."}</p>}
  <section className="panel" data-help-block="admin-finance-basis"><h2>Adatkezelés és jogosultság</h2><p>Csak ellenőrzött felhatalmazás, megfelelő jogalap és előzetes tájékoztatás után engedélyezz hozzáférést. A gazda pénzügyi adatai elkülönítettek, minden szaktanácsadói megtekintés naplózott. Tulajdonosváltás esetén a régi jogosultság automatikusan érvényét veszti. <Link href="/adatkezeles">Pénzügyi adatkezelési tájékoztató</Link></p></section>
  <section className="panel" data-help-block="admin-finance-grant"><h2>Hozzárendelés engedélyezése</h2><form action={grantAdvisorFinance} style={{display:"grid",gap:12,maxWidth:650}}>
   <label>Gazdaság<select required name="farm_id" defaultValue=""><option disabled value="">Válassz</option>{(farms??[]).map(f=><option key={f.id} value={f.id}>{f.name} – {names.get(f.owner_id)??"Gazdálkodó"}</option>)}</select></label>
   <label>Szaktanácsadó<select required name="advisor_id" defaultValue=""><option disabled value="">Válassz</option>{advisors.map(a=><option value={a.id} key={a.id}>{a.full_name??"Szaktanácsadó"}</option>)}</select></label>
   <label>Megállapodás vagy jogalap hivatkozása<input name="authorization_reference" required minLength={8} maxLength={400} placeholder="Pl. szerződésszám, dátum"/></label>
   <label style={{display:"flex",gap:9,alignItems:"center"}}><input name="basis_ack" type="checkbox" value="yes" required/> Igazolom a megfelelő jogalap és tájékoztatás meglétét.</label>
   <button className="btn btn-primary">Pénzügyi hozzáférés engedélyezése</button>
  </form></section>
  <section className="panel" data-help-block="admin-finance-current"><h2>Aktív hozzárendelések ({active.length})</h2>{active.length?active.map(g=><article key={`${g.farm_id}-${g.advisor_id}`} style={{border:"1px solid #e6d9dc",padding:13,borderRadius:11,marginTop:9,display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{farmNames.get(g.farm_id)}</strong><p>{names.get(g.advisor_id)} · {g.authorization_reference}</p>{owners.get(g.farm_id)!==g.owner_id&&<p style={{color:"#a3333a"}}>Tulajdonosváltás: automatikusan érvénytelen jogosultság.</p>}</div><form action={revokeAdvisorFinance} style={{display:"flex",gap:8,flexWrap:"wrap"}}><input type="hidden" name="farm_id" value={g.farm_id}/><input type="hidden" name="advisor_id" value={g.advisor_id}/><input name="reason" placeholder="Visszavonás indoka" minLength={8} maxLength={400} required/><button className="ghost-btn">Visszavonás</button></form></article>):<p>Még nincs engedélyezett pénzügyi betekintés.</p>}</section>
 </main>;
}
