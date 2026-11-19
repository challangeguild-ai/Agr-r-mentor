import {randomUUID} from "node:crypto";

export type NewTaskPayload={
 farm_id:string;
 field_id:string|null;
 title:string;
 description:string|null;
 due_date:string|null;
 priority:string;
 status:"open";
 assigned_to:string;
 created_by:string;
};

type SavedTask=Pick<NewTaskPayload,
 "farm_id"|"field_id"|"title"|"description"|"due_date"|"priority"|"assigned_to"|"created_by"
>&{id:string};
export type TaskCreateResult={id:string;alreadyExists:boolean};

const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_FIELDS=[
 "farm_id","field_id","title","description","due_date","priority","assigned_to","created_by"
] as const;

export function taskRequestId(value:string):string{
 const trimmed=value.trim();
 if(!trimmed)return randomUUID();
 if(!UUID_PATTERN.test(trimmed))throw new Error("A teendő mentési azonosítója érvénytelen. Frissítsd az oldalt.");
 return trimmed.toLowerCase();
}

async function findTask(supabase:any,id:string):Promise<SavedTask|null>{
 const{data,error}=await supabase.from("tasks")
  .select("id,farm_id,field_id,title,description,due_date,priority,assigned_to,created_by")
  .eq("id",id).maybeSingle();
 if(error)throw new Error(`A korábbi teendő ellenőrzése sikertelen: ${error.message}`);
 return data||null;
}

function checkedExisting(task:SavedTask,payload:NewTaskPayload):TaskCreateResult{
 if(TASK_FIELDS.some(key=>task[key]!==payload[key]))
  throw new Error("Ez a mentési azonosító már egy másik feladathoz tartozik. Ellenőrizd a teendőlistát, majd frissítsd az oldalt.");
 return{id:task.id,alreadyExists:true};
}

// Reusing the same UUID converts an uncertain response or rapid retry into one task.
// This protects only attempts carrying the same ID, not two independent creations.
export async function createTaskOnce(
 supabase:any,
 payload:NewTaskPayload,
 requestId:string
):Promise<TaskCreateResult>{
 const id=taskRequestId(requestId);
 const previous=await findTask(supabase,id);
 if(previous)return checkedExisting(previous,payload);

 let data:{id:string}|null=null;
 let error:unknown=null;
 try{
  const result=await supabase.from("tasks").insert({id,...payload}).select("id").single();
  data=result.data;
  error=result.error;
 }catch(cause){error=cause}
 if(!error&&data?.id===id)return{id,alreadyExists:false};

 // A timed-out INSERT or primary-key conflict may still mean the first write won.
 const recovered=await findTask(supabase,id);
 if(recovered)return checkedExisting(recovered,payload);
 const message=error instanceof Error?error.message
  :typeof error==="object"&&error&&"message" in error?String(error.message)
  :"A teendő létrehozását nem sikerült visszaigazolni.";
 throw new Error(`${message} A teendőlistát ellenőrizd újraküldés előtt.`);
}
