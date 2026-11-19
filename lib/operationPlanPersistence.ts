/** Retry-safe persistence for the two-step task + operation-plan workflow. */

export type OperationPlanPayload={
 task_id:string;
 country_code:string;
 operation_type:string;
 [key:string]:unknown;
};

// Compare the user-selected plan fields, not live catalogue snapshots that may
// legitimately change after the first successful write.
const PLAN_FIELDS=[
 "country_code","operation_type","subtype","product_id",
 "plant_protection_use_id","product_name","crop","target",
 "planned_dose","dose_unit","planned_area","planned_quantity",
 "quantity_unit","approval_required","requested_approver_id"
] as const;
const NUMERIC_FIELDS=new Set<string>(["planned_dose","planned_area","planned_quantity"]);

function sameValue(key:string,saved:unknown,requested:unknown):boolean{
 const left=saved??null,right=requested??null;
 if(left===null||right===null)return left===right;
 if(NUMERIC_FIELDS.has(key))return Number(left)===Number(right);
 return left===right;
}

async function readPlan(supabase:any,taskId:string):Promise<Record<string,unknown>|null>{
 const{data,error}=await supabase.from("task_operation_plans")
  .select(["task_id",...PLAN_FIELDS].join(","))
  .eq("task_id",taskId).maybeSingle();
 if(error)throw new Error(`A korábbi műveleti terv ellenőrzése sikertelen: ${error.message}`);
 return data||null;
}

function verifyPlan(existing:Record<string,unknown>,payload:OperationPlanPayload){
 if(PLAN_FIELDS.some(key=>!sameValue(key,existing[key],payload[key])))
  throw new Error("Ez a mentési azonosító már eltérő műveleti tervhez tartozik. Ellenőrizd a munkalistát, majd frissítsd az oldalt.");
}

export async function ensureOperationPlanOnce(
 supabase:any,payload:OperationPlanPayload
):Promise<{alreadyExists:boolean}>{
 const existing=await readPlan(supabase,payload.task_id);
 if(existing){verifyPlan(existing,payload);return{alreadyExists:true}}

 let failure:unknown=null;
 try{
  const{error}=await supabase.from("task_operation_plans").insert(payload);
  if(!error)return{alreadyExists:false};
  failure=error;
 }catch(error){failure=error}

 // An INSERT can commit even when its HTTP response is lost. Only retry the
 // missing plan, never delete the already-created parent task.
 const recovered=await readPlan(supabase,payload.task_id);
 if(recovered){verifyPlan(recovered,payload);return{alreadyExists:true}}
 const reason=failure instanceof Error?failure.message
  :typeof failure==="object"&&failure&&"message" in failure?String(failure.message)
  :"ismeretlen adatkapcsolati hiba";
 throw new Error(`A feladat (${payload.task_id}) megmaradt, de a hozzá tartozó műveleti terv mentése nem igazolt (${reason}). Ugyanebből az űrlapból próbáld újra; új feladatot nem hozunk létre.`);
}

async function readMachine(supabase:any,taskId:string):Promise<string|null>{
 const{data,error}=await supabase.from("task_machine_assignments")
  .select("machine_id").eq("task_id",taskId).maybeSingle();
 if(error)throw new Error(`A gépkiosztás ellenőrzése sikertelen: ${error.message}`);
 return data?.machine_id||null;
}

export async function ensureOperationMachineOnce(
 supabase:any,taskId:string,machineId:string,userId:string
):Promise<"confirmed"|"missing"|"conflict">{
 const existing=await readMachine(supabase,taskId);
 if(existing)return existing===machineId?"confirmed":"conflict";
 try{
  const{error}=await supabase.from("task_machine_assignments")
   .insert({task_id:taskId,machine_id:machineId,assigned_by:userId});
  if(!error)return"confirmed";
 }catch{/* The write may still have committed; verify below. */}
 const recovered=await readMachine(supabase,taskId);
 return recovered===machineId?"confirmed":recovered?"conflict":"missing";
}
