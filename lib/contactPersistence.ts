// Reconcile contact rows without deleting the old list before new rows persist.
export type ContactRow={
 id:string;
 contact_type:"phone"|"email";
 label:string;
 value:string;
 is_primary:boolean;
};
export type ContactValue=Omit<ContactRow,"id">;
type Update={id:string;label:string;is_primary:boolean};

export function planContactSync(existing:ContactRow[],desired:ContactValue[]):{
 inserts:ContactValue[];
 updates:Update[];
 removeIds:string[];
}{
 const remaining=new Map<string,ContactRow[]>();
 const key=(row:ContactValue)=>`${row.contact_type}:${row.value}`;
 for(const row of existing){
  const k=key(row);
  remaining.set(k,[...(remaining.get(k)||[]),row]);
 }
 const inserts:ContactValue[]=[],updates:Update[]=[];
 for(const value of desired){
  const matches=remaining.get(key(value))||[];
  const current=matches.shift();
  if(!current){inserts.push(value);continue}
  if(current.label!==value.label||current.is_primary!==value.is_primary)
   updates.push({id:current.id,label:value.label,is_primary:value.is_primary});
 }
 return{inserts,updates,removeIds:[...remaining.values()].flat().map(row=>row.id)};
}

export async function syncContactRows(
 supabase:any,
 table:"farm_contacts"|"profile_contacts",
 ownerKey:"farm_id"|"profile_id",
 ownerId:string,
 desired:ContactValue[],
 extra:Record<string,unknown>={}
):Promise<void>{
 const{data:existing,error:readError}=await supabase.from(table)
  .select("id,contact_type,label,value,is_primary").eq(ownerKey,ownerId);
 if(readError)throw new Error(`A meglévő elérhetőségek ellenőrzése sikertelen: ${readError.message}`);
 const{inserts,updates,removeIds}=planContactSync(existing||[],desired);

 // Persist new information first; remove discarded rows only after successful writes.
 if(inserts.length){
  const{data:inserted,error}=await supabase.from(table)
   .insert(inserts.map(row=>({...row,[ownerKey]:ownerId,...extra}))).select("id");
  if(error||inserted?.length!==inserts.length)
   throw new Error(`Az új elérhetőségek mentése nem igazolható: ${error?.message||"hiányzó visszaigazolás"}`);
 }
 for(const update of updates){
  const{data:saved,error}=await supabase.from(table)
   .update({label:update.label,is_primary:update.is_primary})
   .eq("id",update.id).eq(ownerKey,ownerId).select("id").maybeSingle();
  if(error||!saved)throw new Error(`Az elérhetőség módosítása nem igazolható: ${error?.message||"nincs hozzáférés"}`);
 }
 if(removeIds.length){
  const{data:removed,error}=await supabase.from(table)
   .delete().eq(ownerKey,ownerId).in("id",removeIds).select("id");
  if(error||removed?.length!==removeIds.length)
   throw new Error(`A régi elérhetőségek törlése nem igazolható: ${error?.message||"hiányzó visszaigazolás"}`);
 }
}
