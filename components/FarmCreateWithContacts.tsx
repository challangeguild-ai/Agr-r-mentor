"use client";
import {useState} from "react";
import {ContactFields} from "@/components/ContactFields";
import {createFarmWithContacts} from "@/app/admin/client-contact-actions";

type SavedFarm={id:string;ownerId:string;status:"created"|"existing";warning?:string};

export function FarmCreateWithContacts({farmers}:{farmers:{id:string;full_name:string|null}[]}){
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[saved,setSaved]=useState<SavedFarm|null>(null);

 async function submit(formData:FormData){
  if(busy||saved)return;
  setBusy(true);
  setError("");
  try{
   const result=await createFarmWithContacts(formData);
   if(result.warning){setSaved(result);setBusy(false);return}
   window.location.reload();
  }catch(error){
   setError(error instanceof Error?error.message:"A gazdaság létrehozása sikertelen.");
   setBusy(false);
  }
 }

 return <form action={submit} className="admin-form">
  <label>Gazdálkodó<select name="owner_id" required disabled={!!saved}>
   <option value="">Válassz ügyfelet</option>
   {farmers.map(f=><option key={f.id} value={f.id}>{f.full_name||"Névtelen ügyfél"}</option>)}
  </select></label>
  <label>Gazdaság neve<input name="name" required disabled={!!saved}/></label>
  <label>Település<input name="settlement" disabled={!!saved}/></label>
  <label>Cím<input name="address" disabled={!!saved}/></label>
  <div style={{gridColumn:"1/-1"}}>
   <b style={{display:"block",marginBottom:8}}>Kapcsolattartási adatok</b>
   <ContactFields/>
  </div>
  {error&&<div className="error-box" role="alert" style={{gridColumn:"1/-1"}}>{error}</div>}
  {saved&&<div role="status" style={{gridColumn:"1/-1",padding:14,borderRadius:10,border:"1px solid #e9c780",background:"#fff8e7"}}>
   <strong>{saved.status==="created"?"A gazdaság létrejött.":"A gazdaság már létezik."}</strong>
   <p style={{margin:"8px 0"}}>{saved.warning}</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
    <a className="btn btn-secondary" href={`/admin/clients/${saved.ownerId}/farms/${saved.id}`}>Gazdaság megnyitása</a>
    <a className="btn btn-secondary" href="/admin/contacts">Kapcsolattartók ellenőrzése</a>
   </div>
  </div>}
  <button className="btn btn-secondary" disabled={busy||!!saved}>
   {busy?"Mentés…":saved?"Már rögzítve":"Gazdaság létrehozása"}
  </button>
 </form>;
}
