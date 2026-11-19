import {randomUUID} from "node:crypto";

export type OperationCreatePayload={
 farm_id:string;
 field_id:string;
 operation_date:string;
 operation_type:string;
 created_by:string;
 [key:string]:unknown;
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=[
 "farm_id","field_id","operation_date","operation_type","country_code",
 "subtype","product_id","plant_protection_use_id","product_name",
 "authorization_number","crop","target","active_ingredient","dose",
 "dose_unit","quantity","quantity_unit","treated_area","machine_id",
 "machine_name","operator_name","weather","notes","catalog_mode",
 "regulatory_category","approval_required","requested_approver_id","created_by"
] as const;
const NUMBERS=new Set<string>(["dose","quantity","treated_area"]);

export function operationRequestId(raw:string):string{
 const id=raw.trim();
 if(!id)return randomUUID();
 if(!UUID.test(id))throw new Error("Érvénytelen műveleti mentési azonosító. Frissítsd az oldalt.");
 return id.toLowerCase();
}

async function findOperation(supabase:any,id:string):Promise<Record<string,unknown>|null>{
 const{data,error}=await supabase.from("field_operations")
  .select(["id",...FIELDS].join(",")).eq("id",id).maybeSingle();
 if(error)throw new Error(`A korábbi művelet ellenőrzése sikertelen: ${error.message}`);
 return data||null;
}

function equivalent(field:string,saved:unknown,expected:unknown):boolean{
 const left=saved??null,right=expected??null;
 if(left===null||right===null)return left===right;
 return NUMBERS.has(field)?Number(left)===Number(right):left===right;
}

function checkExisting(existing:Record<string,unknown>,payload:OperationCreatePayload,id:string){
 if(FIELDS.some(field=>!equivalent(field,existing[field],payload[field])))
  throw new Error("Ez a mentési azonosító már egy eltérő művelethez tartozik. Ellenőrizd a műveleti naplót, majd frissítsd az oldalt.");
 return{id,alreadyExists:true as const};
}

/** A response timeout is not proof that INSERT failed. Verify by stable UUID. */
export async function createOperationOnce(
 supabase:any,payload:OperationCreatePayload,requestId:string
):Promise<{id:string;alreadyExists:boolean}>{
 const id=operationRequestId(requestId);
 const previous=await findOperation(supabase,id);
 if(previous)return checkExisting(previous,payload,id);

 let failure:unknown=null;
 try{
  const{data,error}=await supabase.from("field_operations")
   .insert({id,...payload}).select("id").single();
  if(!error&&data?.id===id)return{id,alreadyExists:false};
  failure=error;
 }catch(error){failure=error}

 const recovered=await findOperation(supabase,id);
 if(recovered)return checkExisting(recovered,payload,id);
 const reason=failure instanceof Error?failure.message
  :typeof failure==="object"&&failure&&"message" in failure?String(failure.message)
  :"ismeretlen adatkapcsolati hiba";
 throw new Error(`A művelet rögzítése nem igazolható (${reason}). Ellenőrizd a naplót; ugyanebből az űrlapból biztonságosan újrapróbálhatod.`);
}
