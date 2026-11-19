import type {ContactInput} from "./contactInput";

export type FarmInput={
 owner_id:string;
 name:string;
 settlement:string|null;
 address:string|null;
};
export type FarmCreationResult={
 id:string;
 status:"created"|"existing";
 warning?:string;
};

function escapeLike(value:string){return value.replace(/[\\%_]/g,"\\$&")}

async function findExistingFarm(supabase:any,input:FarmInput):Promise<string|null>{
 let query=supabase.from("farms").select("id")
  .eq("owner_id",input.owner_id).ilike("name",escapeLike(input.name));
 query=input.settlement?query.ilike("settlement",escapeLike(input.settlement)):query.is("settlement",null);
 query=input.address?query.ilike("address",escapeLike(input.address)):query.is("address",null);
 const{data,error}=await query.limit(1).maybeSingle();
 if(error)throw new Error(`A meglévő gazdaságok ellenőrzése sikertelen: ${error.message}`);
 return data?.id||null;
}

// Once created, never remove the farm to compensate for a contact write failure.
export async function createFarmRecord(
 supabase:any,
 input:FarmInput,
 contacts:ContactInput[]
):Promise<FarmCreationResult>{
 const existingId=await findExistingFarm(supabase,input);
 if(existingId)return{
  id:existingId,
  status:"existing",
  warning:"Ez a gazdaság már szerepel a rendszerben. Ellenőrizd az elérhetőségeit, új gazdaság nem jött létre."
 };

 const{data:farm,error}=await supabase.from("farms").insert(input).select("id").single();
 if(error||!farm){
  // Network errors can hide successful writes. Look for the farm before retrying.
  const recoveredId=await findExistingFarm(supabase,input);
  if(recoveredId)return{
   id:recoveredId,
   status:"existing",
   warning:"A gazdaságot megtaláltam, de a mentési visszaigazolás nem érkezett meg. Ellenőrizd az elérhetőségeit."
  };
  throw new Error(error?.message||"A gazdaság létrehozása sikertelen.");
 }

 try{
  const{data:saved,error:contactError}=await supabase.from("farm_contacts")
   .insert(contacts.map(contact=>({...contact,farm_id:farm.id}))).select("id");
  if(contactError||!Array.isArray(saved)||saved.length!==contacts.length)
   throw new Error(contactError?.message||"hiányzó adatbázis-visszaigazolás");
 }catch(error){
  console.error("Gazdaság létrejött, kapcsolattartói mentés nem igazolt",error);
  return{
   id:farm.id,
   status:"created",
   warning:"A gazdaság létrejött, de a kapcsolattartók mentése nem igazolható. Ne hozd létre újra: ellenőrizd és szükség esetén pótold az elérhetőségeket a Kapcsolattartók oldalon."
  };
 }
 return{id:farm.id,status:"created"};
}
